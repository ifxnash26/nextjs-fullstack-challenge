export function LoginForm() {
  return (
    <form action="/api/auth/login" method="post" className="auth-form">
      <h1>Login</h1>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={6} />
      </label>
      <button type="submit">Login</button>
    </form>
  );
}
