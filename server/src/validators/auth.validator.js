const { z } = require("zod");

const registrationSchema = z
    .object({
        username: z
            .string()
            .min(3)
            .max(30),

        email: z
            .string()
            .email()
            .max(254)
            .optional()
            .nullable(),

        phoneNumber: z
            .string()
            .max(20)
            .optional()
            .nullable(),

        password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    })
    .superRefine((data, ctx) => {
        const hasEmail =
            typeof data.email === "string" &&
            data.email.trim().length > 0;

        const hasPhone =
            typeof data.phoneNumber === "string" &&
            data.phoneNumber.trim().length > 0;

        if (!hasEmail && !hasPhone) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message:
                    "Email or phone number is required"
            });
        }
    });

function validateRegistrationInput(input) {
    return registrationSchema.safeParse(input);
}

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    phoneNumber: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .optional(),

    password: z
      .string()
      .min(8)
      .max(128),
  })
  .superRefine((data, ctx) => {
    const identityCount =
      Number(Boolean(data.email)) +
      Number(Boolean(data.phoneNumber));

    if (identityCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide exactly one of email or phoneNumber.",
      });
    }
  });

  function validateLoginInput(input) {
  return loginSchema.parse(input);
}

module.exports = Object.freeze({
    validateRegistrationInput,
    validateLoginInput
});