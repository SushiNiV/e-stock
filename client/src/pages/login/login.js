import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './login.css';
import { RiEyeFill, RiEyeOffFill, RiMailFill } from 'react-icons/ri';

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-wrapper">
      <div className="login-bg-mask"></div>
      <img src="/assets/store.png" alt="Store" className="store-overlay" />
      <div className="login-content-wrapper">
                <div className="login-container grid">

          <div className="login-box">
            <h1 className="login-title">Log in to your account.</h1>
            <div className="login-form-wrapper">
              <form className="login-form">
                <div className="form-fields grid">
                  <div className="form-group">
                    <input type="email" required placeholder=" " className="form-input" />
                    <label className="form-label">Email</label>
                    <RiMailFill className="form-icon" />
                  </div>

                  <div className="form-group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder=" "
                      className="form-input"
                    />
                    <label className="form-label">Password</label>
                    <span
                      className="form-icon password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <RiEyeFill /> : <RiEyeOffFill />}
                    </span>
                  </div>
                </div>

                <a href="#" className="forgot-password-link">Forgot your password?</a>
                <button type="submit" className="login-btn">Login</button>
              </form>

              <div className="social-login">
                <p className="social-login-title">Or login with</p>
                <div className="social-icons">
                  <a href="#" className="social-icon">
                    <img src="assets/icon-google.svg" alt="Google" />
                  </a>
                  <a href="#" className="social-icon">
                    <img src="assets/icon-facebook.svg" alt="Facebook" />
                  </a>
                  <a href="#" className="social-icon">
                    <img src="assets/icon-apple.svg" alt="Apple" />
                  </a>
                </div>
              </div>

              <p className="signup-link">
                Don't have an account? <Link to="/register"><button>Create Account</button></Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;