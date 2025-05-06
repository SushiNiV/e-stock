import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './login.css';
import { RiEyeFill, RiEyeOffFill, RiUser3Fill } from 'react-icons/ri';

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const { token, storeId, username, firstName, lastName, role } = data;

        // ✅ Save everything under one `user` key
        const userObject = { storeId, username, firstName, lastName, role };
        localStorage.setItem('user', JSON.stringify(userObject));
        localStorage.setItem('token', token);

        console.log('User details saved in localStorage:', userObject);

        // ✅ Redirect to dashboard
        navigate('/dashboard');
      } else {
        const error = await res.json();
        alert(`Login failed: ${error.message}`);
      }
    } catch (err) {
      console.error('Error during login:', err);
      alert('Login error. Please check your credentials and try again.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg-mask"></div>
      <img src="/assets/store.png" alt="Store" className="store-overlay" />
      <div className="login-content-wrapper">
        <div className="login-container grid">
          <div className="login-box">
            <h1 className="login-title">Log in to your account.</h1>
            <div className="login-form-wrapper">
              <form className="login-form" onSubmit={handleLogin}>
                <div className="form-fields grid">
                  <div className="form-group">
                    <input
                      type="text"
                      required
                      placeholder=" "
                      className="form-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <label className="form-label">Username</label>
                    <RiUser3Fill className="form-icon" />
                  </div>

                  <div className="form-group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder=" "
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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