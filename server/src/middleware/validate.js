import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validate `req.body` / `req.params` / `req.query` against Zod schemas.
 * Replaces each part with the parsed (and coerced) value on success.
 *
 * Usage:
 *   router.post('/', validate({ body: createEventSchema }), handler)
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const key of ['body', 'params', 'query']) {
      if (schemas[key]) {
        req[key] = schemas[key].parse(req[key]);
      }
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    return next(err);
  }
};

export default validate;
