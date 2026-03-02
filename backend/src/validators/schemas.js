const { z } = require('zod');

const tradeCategoryEnum = z.enum([
  'PLUMBING',
  'ELECTRICAL',
  'PAINTING_DECORATING',
  'CARPENTRY',
  'ROOFING',
  'PLASTERING',
  'TILING',
  'FLOORING',
  'HEATING_BOILERS',
  'GARDENING_LANDSCAPING',
  'CLEANING',
  'REMOVALS',
  'BUILDING_CONSTRUCTION',
  'LOCKSMITH',
  'OTHER_NOT_SURE',
]);

const jobStatusEnum = z.enum([
  'PENDING',
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
]);

const passwordSchema = z.string().min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[a-z]/, 'At least one lowercase letter')
  .regex(/[0-9]/, 'At least one number');

exports.registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long').trim(),
    email: z
      .string()
      .email('Invalid email')
      .max(254, 'Email is too long')
      .trim()
      .toLowerCase(),
    password: passwordSchema,
    role: z.enum(['homeowner', 'tradesperson']),
    address: z.string().max(255, 'Address is too long').trim().optional(),
    townOrCity: z.string().max(255, 'Town/city is too long').trim().optional(),
  }).refine((d) => {
    if (d.role === 'homeowner') return !!d.address?.trim();
    if (d.role === 'tradesperson') return !!d.townOrCity?.trim();
    return true;
  }, { message: 'address required for homeowner, townOrCity for tradesperson' }),
});

exports.loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email')
      .max(254, 'Email is too long')
      .trim()
      .toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

exports.forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email')
      .max(254, 'Email is too long')
      .trim()
      .toLowerCase(),
  }),
});

exports.resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required').max(500, 'Token is too long'),
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
    name: z.string().min(1).max(100).trim().optional(),
    address: z.string().max(255).trim().optional(),
    townOrCity: z.string().max(255).trim().optional(),
    availability: z.boolean().optional(),
    categories: z.array(tradeCategoryEnum).optional(),
  }),
});

exports.createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(140, 'Title is too long').trim(),
    description: z
      .string()
      .min(1, 'Description is required')
      .max(4000, 'Description is too long')
      .trim(),
    category: tradeCategoryEnum,
    locationText: z
      .string()
      .min(1, 'Location is required')
      .max(255, 'Location is too long')
      .trim(),
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
    comment: z.string().max(4000, 'Comment is too long').trim().optional(),
  }),
});

exports.sendMessageSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Message content is required')
      .max(4000, 'Message is too long')
      .trim(),
  }),
});

// Generic :id param validation
exports.idParamSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

// GET /jobs/my query validation
exports.getMyJobsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/)
      .transform((v) => Number(v))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform((v) => Number(v))
      .optional(),
    status: jobStatusEnum.optional(),
    category: tradeCategoryEnum.optional(),
  }),
});

// GET /jobs/nearby query validation
exports.getNearbyJobsSchema = z.object({
  query: z.object({
    category: tradeCategoryEnum.optional(),
  }),
});
