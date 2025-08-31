// middleware/authMiddleware.js
export const ensureAdmin = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  req.flash("error", "Please login as admin.");
  return res.redirect("/admin/login");
};
