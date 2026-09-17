import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignJWT, UnsecuredJWT } from 'jose';
import { issueToken, readToken, tokenFromRequest } from './token.js';

/**
 * What a token will and will not accept.
 *
 * These are the cases that decide whether the token means anything: if a
 * forged one verifies, every endpoint behind it is as open as it was before
 * any of this work started, and nothing on screen would look different.
 */

const SECRET = 'a-signing-secret-long-enough-to-be-plausible';

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.AUTH_TOKEN_SECRET;
});

const encode = (secret) => new TextEncoder().encode(secret);

describe('a token we issued', () => {
  it('reads back as the fisher it was made for', async () => {
    const token = await issueToken({ id: '6aabc61a31744b6b7d49dccd', role: 'admin' });

    expect(await readToken(token)).toEqual({
      id: '6aabc61a31744b6b7d49dccd',
      role: 'admin'
    });
  });

  it('defaults to the ordinary role when none was given', async () => {
    const token = await issueToken({ id: 'someone' });

    expect((await readToken(token)).role).toBe('user');
  });
});

describe('a token we did not issue', () => {
  it('is refused when signed with another secret', async () => {
    const forged = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('someone-elses-id')
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(encode('not-the-real-secret'));

    expect(await readToken(forged)).toBeNull();
  });

  it('is refused when it carries no signature at all', async () => {
    // The classic forgery: drop the algorithm and hope the reader obliges.
    const unsigned = new UnsecuredJWT({ role: 'admin' }).setSubject('anyone').encode();

    expect(await readToken(unsigned)).toBeNull();
  });

  it('is refused when the payload has been edited', async () => {
    const honest = await issueToken({ id: 'a-fisher', role: 'user' });
    const [header, , signature] = honest.split('.');

    const edited = Buffer.from(JSON.stringify({ sub: 'a-fisher', role: 'admin' }))
      .toString('base64url');

    expect(await readToken(`${header}.${edited}.${signature}`)).toBeNull();
  });

  it('is refused once it has expired', async () => {
    const stale = await new SignJWT({ role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('a-fisher')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(encode(SECRET));

    expect(await readToken(stale)).toBeNull();
  });

  it('is refused when it names nobody', async () => {
    const anonymous = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(encode(SECRET));

    expect(await readToken(anonymous)).toBeNull();
  });

  it('is refused when it is not a token at all', async () => {
    expect(await readToken('')).toBeNull();
    expect(await readToken('nonsense')).toBeNull();
    expect(await readToken(null)).toBeNull();
  });
});

describe('with no secret configured', () => {
  beforeEach(() => {
    delete process.env.AUTH_TOKEN_SECRET;
  });

  it('issues nothing', async () => {
    expect(await issueToken({ id: 'someone' })).toBeNull();
  });

  it('accepts nothing, not even a token that was properly signed', async () => {
    process.env.AUTH_TOKEN_SECRET = SECRET;
    const real = await issueToken({ id: 'someone' });
    delete process.env.AUTH_TOKEN_SECRET;

    expect(await readToken(real)).toBeNull();
  });
});

describe('reading the Authorization header', () => {
  const from = (headers) => tokenFromRequest({ headers });

  it('takes the value after Bearer', () => {
    expect(from({ authorization: 'Bearer abc.def.ghi' })).toBe('abc.def.ghi');
  });

  it('does not care how Bearer is capitalised', () => {
    expect(from({ authorization: 'bearer abc.def.ghi' })).toBe('abc.def.ghi');
  });

  it('ignores other schemes', () => {
    expect(from({ authorization: 'Basic dXNlcjpwYXNz' })).toBeNull();
  });

  it('copes with the header being absent or empty', () => {
    expect(from({})).toBeNull();
    expect(from({ authorization: '' })).toBeNull();
    expect(from({ authorization: 'Bearer' })).toBeNull();
    expect(from({ authorization: 'Bearer   ' })).toBeNull();
    expect(tokenFromRequest(undefined)).toBeNull();
  });
});
