const { z } = require('zod');

const tradeCategoryEnum = z.enum([
  'PLUMBING', 'ELECTRICAL', 'PAINTING_DECORATING', 'CARPENTRY', 'ROOFING',
  'PLASTERING', 'TILING', 'FLOORING', 'HEATING_BOILERS', 'GARDENING_LANDSCAPING',
  'CLEANING', 'REMOVALS', 'BUILDING_CONSTRUCTION', 'LOCKSMITH', 'OTHER_NOT_SURE',
]);

const passwordSchema = z.string().min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[a-z]/, 'At least one lowercase letter')
  .regex(/[0-9]/, 'At least one number');

exports.registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    email: z.string().email('Invalid email').trim().toLowerCase(),
    password: passwordSchema,
    role: z.enum(['homeowner', 'tradesperson']),
    address: z.string().optional(),
    townOrCity: z.string().optional(),
  }).refine((d) => {
    if (d.role === 'homeowner') return !!d.address?.trim();
    if (d.role === 'tradesperson') return !!d.townOrCity?.trim();
    return true;
  }, { message: 'address required for homeowner, townOrCity for tradesperson' }),
});

exports.loginSchema = z.object({
  body: z.object({
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

exports.forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().email().trim().toLowerCase() }),
});

exports.resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: passwordSchema,
  }),
});

exports.changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
});

exports.updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).trim().optional(),
    address: z.string().optional(),
    townOrCity: z.string().optional(),
    availability: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
  }),
});

exports.createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').trim(),
    description: z.string().min(1, 'Description is required').trim(),
    category: tradeCategoryEnum,
    locationText: z.string().min(1, 'Location is required').trim(),
  }),
});

exports.respondToJobSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({ response: z.enum(['ACCEPTED', 'DECLINED']) }),
});

exports.submitReviewSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
  }),
});

exports.sendMessageSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({ content: z.string().min(1, 'Message content is required').trim() }),
});
