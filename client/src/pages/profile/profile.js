import React from 'react';
import './profile.css';

const Profile = () => {
  const user = {
    profilePic: null,
    username: 'snv',
    firstName: 'Sushane',
    lastName: 'Vendiola',
    email: 'snv@gmail.com',
    role: 'Admin',
    storeName: 'Sushi Store',
    storeAddress: 'Caloocan City',
  };

  return (
    <div className="profile-container">
      <h2 className="profile-title">My Profile</h2>
      <div className="profile-wrapper">
        <div className="profile-content">
          <div className="profile-header">
            <img
              className="profile-picture"
              src={user.profilePic || '/es-logo.png'}
              alt="Profile"
            />
            <div className="profile-info">
              <h3 className="username">@{user.username}</h3>
              <p className="fullname">{user.firstName} {user.lastName}</p>
            </div>
            <button className="edit-profile">Edit Profile</button>
          </div>
        </div>

        <hr />

        <div className="profile-details">
          <h3 className="profile-heads">Profile Details</h3>
          <div className="profile-deets">
            <p><strong>Role:</strong> <span className="deets">{user.storeName}</span></p>
            <p><strong>Email:</strong> <span className="deets">{user.storeAddress}</span></p>
            <p><strong>Contact Number:</strong> <span className="deets">{user.storeAddress}</span></p>
            <p><strong>E-Stock Password:</strong> <span className="deets">********</span></p>
            <br />
            <p><strong>UserCode:</strong> <span className="deets">{user.storeAddress}</span></p>
            <p className="p-info">This is system-generated, unique for every user, and cannot be changed.</p>
          </div>
        </div>

        <hr />

        <div className="profile-details">
          <h3 className="profile-heads">Store Information</h3>
          <div className="profile-deets">
            <p><strong>Store Name:</strong> <span className="deets">{user.storeName}</span></p>
            <p><strong>Store Address:</strong> <span className="deets">{user.storeAddress}</span></p>
            <p><strong>Store Contact Number:</strong> <span className="deets">{user.storeAddress}</span></p>
            <br />
            <p><strong>StoreCode:</strong> <span className="deets">{user.storeAddress}</span></p>
            <p className="p-info">This is system-generated, unique for every store, and cannot be changed.</p>
          </div>
          <button className="edit-profile">Edit Store</button>
        </div>

        <hr />
        
      </div>
    </div>
  );
};

export default Profile;