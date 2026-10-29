import { FileText, LayoutTemplate, MessageSquareText } from 'lucide-react'

/**
 * The welcome side of the sign-in screen (admin.components.beforeLogin). With the styles in
 * admin-refresh.scss the login card becomes two panels on wide screens: the navy brand panel (the
 * logo and this text) on the left, the heading and form on the right. On phones it is a short band
 * above the form.
 */
const JOBS = [
  { icon: FileText, text: 'Write and publish articles, videos, audio and e-books' },
  { icon: LayoutTemplate, text: 'Keep the homepage, menus, banners and insights up to date' },
  { icon: MessageSquareText, text: 'Answer messages and postal library requests' },
] as const

export function LoginIntro() {
  return (
    <div className="im-login-intro">
      <h1 className="im-login-intro__title">Welcome back</h1>
      <p className="im-login-intro__lead">Sign in to manage Islam Malayalam.</p>
      <ul className="im-login-intro__list">
        {JOBS.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className="im-login-intro__icon">
              <Icon aria-hidden="true" />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="im-login-intro__note">For staff accounts only. Ask an admin if you need one.</p>
    </div>
  )
}

/** The heading over the form, in the right-hand column (also admin.components.beforeLogin). */
export function LoginHeading() {
  return (
    <div className="im-login-heading">
      <h2 className="im-login-heading__title">Sign in</h2>
      <p className="im-login-heading__lead">Enter your staff email and password to continue.</p>
    </div>
  )
}
