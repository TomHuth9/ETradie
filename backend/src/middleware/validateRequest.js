// Validates req using a Zod schema that may have body, params, query. On success, assigns parsed values to req.body, req.params, req.query and calls next().
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      if (!result.success) {
        const first = result.error.errors[0];
        const message = first?.message || 'Validation failed';
        return res.status(400).json({ message });
      }
      if (result.data.body) req.body = result.data.body;
      if (result.data.params) req.params = result.data.params;
      if (result.data.query) req.query = result.data.query;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validateRequest };
