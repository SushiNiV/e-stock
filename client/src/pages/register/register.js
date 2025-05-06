import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './register.css';
import { RiEyeFill, RiEyeOffFill, RiMailFill, RiIdCardFill, RiUser3Fill } from 'react-icons/ri';
import { FiChevronDown } from 'react-icons/fi';

function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3001/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          role,
          firstName: name,
          lastName: surname,
          email
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        if (role === 'Admin') {
          navigate('/register-admin');
        } else if (role === 'Cashier') {
          navigate('/register-cashier');
        } else {
          navigate('/login');
        }
      } else {
        const errMsg = await response.text();
        setError(errMsg || 'Registration failed');
      }
    } catch {
      setError('Something went wrong');
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-mask"></div>
      <img src="/assets/store.png" alt="Store" className="store-overlay" />
      <div className="register-position">
        <div className="register container grid">
          <div className="register-access">
            <h1 className="register-title">Create new account</h1>
            <div className="register-area">
              <form className="register-form" onSubmit={handleSubmit}>
                <div className="register-content grid">
                  <div className="register-group grid">
                    <div className="register-box">
                      <input
                        type="text"
                        required
                        placeholder=" "
                        className="register-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <label className="register-label">Name</label>
                      <RiIdCardFill className="register-icon" />
                    </div>
                    <div className="register-box">
                      <input
                        type="text"
                        required
                        placeholder=" "
                        className="register-input"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                      />
                      <label className="register-label">Surname</label>
                      <RiIdCardFill className="register-icon" />
                    </div>
                  </div>
                  <div className="register-box">
                    <input
                      type="email"
                      required
                      placeholder=" "
                      className="register-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <label className="register-label">Email</label>
                    <RiMailFill className="register-icon" />
                  </div>
                  <div className="register-group grid">
                    <div className="register-box">
                      <input
                        type="text"
                        required
                        placeholder=" "
                        className="register-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={15}
                      />
                      <label className="register-label">Username</label>
                      <RiUser3Fill className="register-icon" />
                    </div>
                    <div className="register-box">
                      <select
                        required
                        className={`register-input ${role ? 'selected' : ''}`}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        <option value="" disabled hidden>Select Role</option>
                        <option value="Admin">Admin</option>
                        <option value="Cashier">Cashier</option>
                      </select>
                      <label className="register-label">Role</label>
                      <span className="register-icon">
                        <FiChevronDown />
                      </span>
                    </div>
                  </div>
                  <div className="register-box">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder=" "
                      className="register-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <label className="register-label">Password</label>
                    <span
                      className="register-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <RiEyeFill /> : <RiEyeOffFill />}
                    </span>
                  </div>
                </div>
                {error && <p className="register-error">{error}</p>}
                <button type="submit" className="register-button">Create account</button>
              </form>
              <p className="register-switch">
                Already have an account?{' '}
                <Link to="/login"><button>Log In</button></Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;