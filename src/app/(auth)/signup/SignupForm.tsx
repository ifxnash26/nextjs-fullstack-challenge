export function SignupForm() {
  return (
    <form action="/api/auth/signup" method="post" className="auth-form">
      <h1>Sign up</h1>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Name (optional)
        <input name="name" type="text" />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={6} />
      </label>
      <button type="submit">Create account</button>
    </form>
  );
}
