import { createEndpoint, ValidationError, HttpError } from '../_utils/endpoint.js';
import { sanitizeInput, validateString } from '../_utils/validation.js';

export default createEndpoint({ methods: ['POST'], auth: 'public' }, async (req, res, { db }) => {
  const sanitizedBody = sanitizeInput(req.body);
  const { username, phoneNumber, country, vesselType, mainGearType, boatName, password } = sanitizedBody;

  const validatedUsername = validateString(username, {
    minLength: 1,
    maxLength: 100,
    required: true
  });

  if (!phoneNumber || !country || !vesselType || !mainGearType || !password) {
    throw new ValidationError('Missing required fields');
  }

  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  if (vesselType !== 'Feet' && !boatName) {
    throw new ValidationError('Boat name is required for this vessel type');
  }

  const usersCollection = db.collection('users');

  // Check if username already exists (case-insensitive to match login behavior)
  const existingUser = await usersCollection.findOne({
    username: { $regex: new RegExp(`^${validatedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });
  if (existingUser) {
    throw new HttpError(409, 'Username already exists');
  }

  const newUser = {
    username: validatedUsername,
    phoneNumber,
    Country: country,
    vessel_type: vesselType,
    main_gear_type: mainGearType,
    Boat: boatName || null,
    password, // Plain text password format is fixed out of scope; see docs/API-AUTH-PLAN.md
    IMEI: null, // No IMEI for self-registered fishers
    hasImei: false,
    Community: null,
    Region: null,
    captain: null,
    createdAt: new Date(),
    registrationType: 'self-registered'
  };

  const result = await usersCollection.insertOne(newUser);

  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    userId: result.insertedId.toString()
  });
});
