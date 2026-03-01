const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/schemas');
const { register, login } = require('../controllers/authController');
const { getMe, updateProfile, changePassword, forgotPassword, resetPassword } = require('../controllers/profileController');

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

router.get('/me', auth, getMe);
router.patch('/profile', auth, validateRequest(updateProfileSchema), updateProfile);
router.post('/change-password', auth, validateRequest(changePasswordSchema), changePassword);

module.exports = router;

