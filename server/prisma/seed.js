/**
 * Seed script — creates demo data for the challenge submission:
 *   - 1 Admin/Lead
 *   - 2 Team Members (assigned to the event)
 *   - 1 Event with a handful of generated photos
 *   - 1 published Gallery with a known PIN
 *
 * Run with:  npm run seed   (from /server)  or  npm run seed  (from repo root)
 *
 * Credentials are printed at the end. They are also the values documented in
 * the README's "Demo credentials" section.
 */
import zlib from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import { hashPin } from '../src/utils/pin.js';
import { storage, buildStorageKey } from '../src/services/storage/index.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tiny PNG generator so the seed doesn't need any binary assets committed.
// Produces a solid-colour <size>x<size> RGB PNG.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function solidPng(size, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x += 1) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const COLOURS = [
  [219, 68, 55],
  [66, 133, 244],
  [15, 157, 88],
  [244, 180, 0],
  [171, 71, 188],
  [0, 172, 193],
  [255, 112, 67],
  [92, 107, 192],
];

// ---------------------------------------------------------------------------

const DEMO = {
  admin: { name: 'Aditi Rao (Lead)', email: 'admin@demo.com', password: 'Admin@12345' },
  members: [
    { name: 'Rahul Mehta', email: 'member1@demo.com', password: 'Member@12345' },
    { name: 'Sneha Iyer', email: 'member2@demo.com', password: 'Member@12345' },
  ],
  event: { name: 'Arjun & Priya Wedding', description: 'Wedding shoot — Dec 2026' },
  gallery: { title: 'Arjun & Priya — Selected Photos', pin: '482917' },
  photosPerMember: 6,
};

async function reset() {
  // Order matters because of FK constraints (though cascades would handle it).
  await prisma.galleryPhoto.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Resetting existing data...');
  await reset();

  const admin = await prisma.user.create({
    data: {
      name: DEMO.admin.name,
      email: DEMO.admin.email,
      passwordHash: await hashPassword(DEMO.admin.password),
      role: 'ADMIN',
    },
  });

  const members = [];
  for (const m of DEMO.members) {
    members.push(
      await prisma.user.create({
        data: {
          name: m.name,
          email: m.email,
          passwordHash: await hashPassword(m.password),
          role: 'MEMBER',
        },
      })
    );
  }

  const event = await prisma.event.create({
    data: {
      name: DEMO.event.name,
      description: DEMO.event.description,
      ownerId: admin.id,
      members: { create: members.map((u) => ({ userId: u.id })) },
    },
  });

  console.log('Generating and storing demo photos...');
  const createdPhotos = [];
  let colourIdx = 0;
  for (const member of members) {
    for (let i = 0; i < DEMO.photosPerMember; i += 1) {
      const colour = COLOURS[colourIdx % COLOURS.length];
      colourIdx += 1;
      const png = solidPng(256, colour);
      const filename = `${member.name.split(' ')[0].toLowerCase()}-${i + 1}.png`;
      const key = buildStorageKey(event.id, filename);
      await storage.save({ key, buffer: png, mimeType: 'image/png' });
      createdPhotos.push(
        await prisma.photo.create({
          data: {
            eventId: event.id,
            uploadedById: member.id,
            filename,
            storageKey: key,
            storageUrl: null,
            mimeType: 'image/png',
            fileSize: png.length,
            width: 256,
            height: 256,
          },
        })
      );
    }
  }

  // Admin selects the first 8 photos for the gallery.
  const selected = createdPhotos.slice(0, 8);
  await prisma.photo.updateMany({
    where: { id: { in: selected.map((p) => p.id) } },
    data: { isSelected: true },
  });

  const gallery = await prisma.gallery.create({
    data: {
      eventId: event.id,
      title: DEMO.gallery.title,
      slug: 'demo-gallery',
      pinHash: await hashPin(DEMO.gallery.pin),
      isPublished: true,
      publishedAt: new Date(),
      photos: {
        create: selected.map((p, idx) => ({ photoId: p.id, position: idx })),
      },
    },
  });

  console.log('\n================  DEMO CREDENTIALS  ================');
  console.log(`Admin / Lead     : ${DEMO.admin.email}  /  ${DEMO.admin.password}`);
  DEMO.members.forEach((m, i) =>
    console.log(`Team Member ${i + 1}   : ${m.email}  /  ${m.password}`)
  );
  console.log(`\nEvent            : ${event.name}`);
  console.log(`Photos uploaded  : ${createdPhotos.length}  (selected: ${selected.length})`);
  console.log(`\nPublished gallery slug : ${gallery.slug}`);
  console.log(`Gallery URL (frontend) : <FRONTEND_URL>/gallery/${gallery.slug}`);
  console.log(`Gallery PIN            : ${DEMO.gallery.pin}`);
  console.log('===================================================\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
