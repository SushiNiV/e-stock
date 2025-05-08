import React, { useState } from 'react';

function EditCategory({ category, onClose, onUpdateCategory }) {
  const [form, setForm] = useState({
    name: category.category || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const token = localStorage.getItem('token');
  const storeId = category.storeId;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedName = form.name;

    setIsLoading(true);

    try {
      const res = await fetch(`http://localhost:3003/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formattedName,
          storeId: storeId,
        }),
      });

      if (res.ok) {
        const updatedCategory = await res.json();
        alert('Category updated successfully!');
        setIsLoading(false);
        
        // Notify the parent component to update the category list
        onUpdateCategory(updatedCategory);

        // Close the overlay
        onClose();
      } else {
        const error = await res.json();
        setIsLoading(false);
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      setIsLoading(false);
      alert('Failed to update category.');
    }
  };

  return (
    <div className="a-wrapper">
      <div className="a-content-wrapper">
        <button className="a-close-btn" onClick={onClose}>×</button>
        <div className="a-container grid">
          <div className="a-box">
            <h1 className="a-title">Edit Category</h1>
            <div className="a-form-wrapper">
              <form className="a-form" onSubmit={handleSubmit}>
                <div className="a-form-fields grid">
                  <div className="aform-group">
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder=" "
                      className="a-form-input"
                    />
                    <label className="a-form-label">Category Name</label>
                  </div>
                </div>
                <button type="submit" className="a-btn" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditCategory;