/**
 * End-to-end API tests for the critical flows the challenge calls out:
 *   - authentication & role-based authorization
 *   - photo access controls (member sees only their own photos)
 *   - a Team Member cannot publish a gallery
 *   - gallery publishing workflow
 *   - PIN-protected customer access (wrong PIN rejected, right PIN works)
 *   - unpublished galleries are not reachable
 *
 * These require a throwaway PostgreSQL database. Set TEST_DATABASE_URL and the
 * suite will push the Prisma schema and run. Without it, the suite is skipped
 * (the pure-logic suites in authz.test.js / pin.test.js still run everywhere).
 *
 * Before running, make sure the test database has the current schema:
 *   cd server
 *   DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push
 *
 *   TEST_DATABASE_URL="postgresql://.../photo_platform_test" npm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const TEST_DB = process.env.TEST_DATABASE_URL;
const run = TEST_DB ? describe : describe.skip;

// 1x1 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

run('Photo platform API', () => {
  let app;
  let prisma;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = TEST_DB;
    process.env.JWT_SECRET = 'test-secret';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_DIR = 'uploads-test';

    const { createApp } = await import('../src/app.js');
    app = createApp();
    prisma = (await import('../src/lib/prisma.js')).prisma;

    // Start from a clean slate. Requires the schema to already exist in the
    // test DB (`npx prisma db push` against TEST_DATABASE_URL).
    try {
      await prisma.$executeRawUnsafe(
        'TRUNCATE "GalleryPhoto","Gallery","Photo","EventMember","Event","User" RESTART IDENTITY CASCADE'
      );
    } catch (err) {
      throw new Error(
        `Test DB is not ready. Run:  DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push\nOriginal error: ${err.message}`
      );
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  const ctx = {};

  it('registers an Admin and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Lead', email: 'lead@test.com', password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.token).toBeTruthy();
    ctx.adminToken = res.body.token;
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Lead', email: 'lead@test.com', password: 'Passw0rd!' });
    expect(res.status).toBe(409);
  });

  it('rejects login with a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lead@test.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('creates an event (Admin only)', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ name: 'Wedding', description: 'test' });
    expect(res.status).toBe(201);
    ctx.eventId = res.body.event.id;
  });

  it('adds two Team Members', async () => {
    for (const [i, email] of ['m1@test.com', 'm2@test.com'].entries()) {
      const res = await request(app)
        .post(`/api/events/${ctx.eventId}/members`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Member ${i + 1}`, email, password: 'Passw0rd!' });
      expect(res.status).toBe(201);
    }
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'm1@test.com', password: 'Passw0rd!' });
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'm2@test.com', password: 'Passw0rd!' });
    ctx.member1Token = login1.body.token;
    ctx.member2Token = login2.body.token;
    expect(login1.body.user.role).toBe('MEMBER');
  });

  it('lets each member upload a photo', async () => {
    const up1 = await request(app)
      .post(`/api/events/${ctx.eventId}/photos`)
      .set('Authorization', `Bearer ${ctx.member1Token}`)
      .attach('photos', PNG_1PX, 'm1-photo.png');
    expect(up1.status).toBe(201);
    expect(up1.body.summary.stored).toBe(1);
    ctx.member1PhotoId = up1.body.uploaded[0].id;

    const up2 = await request(app)
      .post(`/api/events/${ctx.eventId}/photos`)
      .set('Authorization', `Bearer ${ctx.member2Token}`)
      .attach('photos', PNG_1PX, 'm2-photo.png');
    expect(up2.status).toBe(201);
    ctx.member2PhotoId = up2.body.uploaded[0].id;
  });

  it('a stranger (unassigned member) cannot upload', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other Lead', email: 'other@test.com', password: 'Passw0rd!' });
    // Downgrade-style: register makes an ADMIN, so use a fresh member instead.
    const add = await request(app)
      .post(`/api/events/${ctx.eventId}/members`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ name: 'Temp', email: 'temp@test.com', password: 'Passw0rd!' });
    expect(add.status).toBe(201);
    // temp IS assigned; instead test an assigned-to-nothing member via a 2nd event
    const ev2 = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ name: 'Other event' });
    const res = await request(app)
      .post(`/api/events/${ev2.body.event.id}/photos`)
      .set('Authorization', `Bearer ${ctx.member1Token}`)
      .attach('photos', PNG_1PX, 'x.png');
    expect(res.status).toBe(403);
  });

  it('member sees only their own photos; admin sees all', async () => {
    const asMember = await request(app)
      .get(`/api/events/${ctx.eventId}/photos`)
      .set('Authorization', `Bearer ${ctx.member1Token}`);
    expect(asMember.status).toBe(200);
    expect(asMember.body.scope).toBe('own');
    expect(asMember.body.photos).toHaveLength(1);

    const asAdmin = await request(app)
      .get(`/api/events/${ctx.eventId}/photos`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);
    expect(asAdmin.body.scope).toBe('all');
    expect(asAdmin.body.photos.length).toBeGreaterThanOrEqual(2);
  });

  it('member cannot fetch another member\'s photo bytes', async () => {
    const res = await request(app)
      .get(`/api/photos/${ctx.member2PhotoId}/raw`)
      .set('Authorization', `Bearer ${ctx.member1Token}`);
    expect(res.status).toBe(403);
  });

  it('member cannot select photos or create a gallery', async () => {
    const sel = await request(app)
      .patch(`/api/events/${ctx.eventId}/photos/selection`)
      .set('Authorization', `Bearer ${ctx.member1Token}`)
      .send({ photoIds: [ctx.member1PhotoId], selected: true });
    expect(sel.status).toBe(403);

    const gal = await request(app)
      .put(`/api/events/${ctx.eventId}/gallery`)
      .set('Authorization', `Bearer ${ctx.member1Token}`)
      .send({ title: 'Nope', pin: '1234', photoIds: [ctx.member1PhotoId] });
    expect(gal.status).toBe(403);
  });

  it('admin selects photos, creates and publishes the gallery', async () => {
    const sel = await request(app)
      .patch(`/api/events/${ctx.eventId}/photos/selection`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ photoIds: [ctx.member1PhotoId, ctx.member2PhotoId], selected: true });
    expect(sel.body.updated).toBe(2);

    const create = await request(app)
      .put(`/api/events/${ctx.eventId}/gallery`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ title: 'Selected Photos', pin: '482917' });
    expect(create.status).toBe(201);
    ctx.galleryId = create.body.gallery.id;
    ctx.slug = create.body.gallery.slug;

    // Not reachable by customers until published
    const before = await request(app).get(`/api/public/galleries/${ctx.slug}`);
    expect(before.status).toBe(404);

    const pub = await request(app)
      .post(`/api/galleries/${ctx.galleryId}/publish`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);
    expect(pub.status).toBe(200);
    expect(pub.body.gallery.isPublished).toBe(true);
  });

  it('customer flow: wrong PIN rejected, correct PIN grants access', async () => {
    const meta = await request(app).get(`/api/public/galleries/${ctx.slug}`);
    expect(meta.status).toBe(200);

    const bad = await request(app)
      .post(`/api/public/galleries/${ctx.slug}/verify`)
      .send({ pin: '000000' });
    expect(bad.status).toBe(401);

    const good = await request(app)
      .post(`/api/public/galleries/${ctx.slug}/verify`)
      .send({ pin: '482917' });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTruthy();
    ctx.galleryToken = good.body.token;

    const photos = await request(app)
      .get(`/api/public/galleries/${ctx.slug}/photos`)
      .set('Authorization', `Bearer ${ctx.galleryToken}`);
    expect(photos.status).toBe(200);
    expect(photos.body.photos).toHaveLength(2);
  });

  it('gallery photos require a valid gallery token', async () => {
    const res = await request(app).get(`/api/public/galleries/${ctx.slug}/photos`);
    expect(res.status).toBe(401);
  });

  it('unpublish makes the gallery unreachable again', async () => {
    await request(app)
      .post(`/api/galleries/${ctx.galleryId}/unpublish`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);
    const res = await request(app).get(`/api/public/galleries/${ctx.slug}`);
    expect(res.status).toBe(404);
  });
});
