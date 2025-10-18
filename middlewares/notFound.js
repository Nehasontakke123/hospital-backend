/**
 * @swagger
 * components:
 *   schemas:
 *     NotFound:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           example: Route not found
 *         statusCode:
 *           type: number
 *           example: 404
 */

const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { notFound };
