import { issueToken } from '../_utils/token.js';
import { createEndpoint, ValidationError, UnauthorizedError } from '../_utils/endpoint.js';

/**
 * Escape special regex characters in a string to prevent regex injection
 * @param {string} str - The string to escape
 * @returns {string} The escaped string safe for use in RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default createEndpoint({ methods: ['POST'], auth: 'public' }, async (req, res, { db }) => {
  const { imei, password } = req.body;

  if (!imei || !password) {
    throw new ValidationError('IMEI/Boat name/Username and password are required');
  }

  const globalPassword = process.env.GLOBAL_PASSW;
  const useGlobalPassword = Boolean(globalPassword) && password === globalPassword;

  const usersCollection = db.collection('users');
  const passwordFilter = useGlobalPassword ? {} : { password };
  const exactRegex = new RegExp(`^${escapeRegex(imei)}$`, 'i');

  let user = await usersCollection.findOne({ IMEI: imei, ...passwordFilter });
  if (!user) {
    user = await usersCollection.findOne({ Boat: { $regex: exactRegex }, ...passwordFilter });
  }
  if (!user) {
    user = await usersCollection.findOne({ username: { $regex: exactRegex }, ...passwordFilter });
  }

  if (!user) {
    throw new UnauthorizedError('Invalid IMEI/Boat name/Username or password');
  }

  const appUser = {
    id: user._id.toString(),
    name: user.Boat || user.username || `Vessel ${user.IMEI?.slice(-4) || 'Unknown'}`,
    username: user.username || null,
    imeis: user.IMEI ? [user.IMEI] : [],
    // An administrator is one whose account says so. The global password
    // still confers admin as a fallback, kept only until every
    // administrator holds an account of their own; see step 2 of
    // docs/API-AUTH-PLAN.md, which retires it.
    role: user.role === 'admin' || useGlobalPassword ? 'admin' : 'user',
    community: user.Community,
    region: user.Region,
    hasImei: user.hasImei !== false && !!user.IMEI
  };

  // The token is how later requests prove they are this user rather than
  // merely naming them. Null when no secret is configured, in which case
  // sign-in still works and the app carries on unauthenticated.
  const token = await issueToken(appUser);

  return res.status(200).json({ ...appUser, token });
});
