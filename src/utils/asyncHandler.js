// const asyncHandler = (RequestHandler) => {
//   return (req, res, next) => {
//     Promise.resolve(RequestHandler(req, res, next)).catch((error) => {
//       next(error);
//     });
//   };
// };
const asyncHandler = (RequestHandler) => {
  return async (req, res, next) => {
    try {
      await RequestHandler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export { asyncHandler };
