// Global variables
let currentUser = null;
let authToken = null;
let modalTaskId = null;
let currentSection = 'overview';

// API Base URL
const API_BASE = (() => {
    try {
        if (window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
            if (window.location.host.includes('localhost:3000') || window.location.host.includes('127.0.0.1:3000')) {
                return '/api';
            } else {
                return 'http://localhost:3000/api';
            }
        }
        return 'http://localhost:3000/api';
    } catch (e) {
        return 'http://localhost:3000/api';
    }
})();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});

// Add global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showToast('An error occurred: ' + e.message, 'error');
});

function initializeApp() {
    // Check for existing token
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        checkAuthStatus();
    }

    // Prefill saved email and remember-me toggle
    const savedEmail = localStorage.getItem('savedEmail');
    const emailInput = document.getElementById('login-email');
    const rememberChk = document.getElementById('remember-me');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberChk) rememberChk.checked = true;
    }

    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    try {
        // Auth forms
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const logoutBtn = document.getElementById('logout-btn');

        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
            console.log('Login form event listener added');
        } else {
            console.error('Login form not found');
        }

        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
            console.log('Register form event listener added');
        } else {
            console.error('Register form not found');
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
            console.log('Logout button event listener added');
        } else {
            console.error('Logout button not found');
        }

        // Admin forms
        const addEmployeeForm = document.getElementById('add-employee-form');
        const addTaskForm = document.getElementById('add-task-form');
        const profileForm = document.getElementById('profile-form');

        if (addEmployeeForm) {
            addEmployeeForm.addEventListener('submit', handleAddEmployee);
            console.log('Add employee form event listener added');
        }

        if (addTaskForm) {
            addTaskForm.addEventListener('submit', handleAddTask);
            console.log('Add task form event listener added');
        }

        if (profileForm) {
            profileForm.addEventListener('submit', handleUpdateProfile);
            console.log('Profile form event listener added');
        }

        // Prevent default navigation for in-app links that use href="#"
        document.querySelectorAll('a.nav-link').forEach(a => {
            a.addEventListener('click', (e) => e.preventDefault());
        });
        // Prevent default for auth tabs too, in case they are anchors in future
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => e.preventDefault());
        });

        console.log('All event listeners set up successfully');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
        showToast('Error setting up event listeners', 'error');
    }
}

// Authentication Functions
async function handleLogin(e) {
    console.log('Login button clicked');
    e.preventDefault();
    showLoading();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            const rememberElement = document.getElementById('remember-me');
            const remember = rememberElement ? rememberElement.checked : false;
            if (remember) {
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('savedEmail', email);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('savedEmail');
            }

            showToast('Login successful!', 'success');
            showApp();
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Cannot connect to server. Please make sure the server is running.', 'error');
        } else {
            showToast('Network error. Please check your connection and try again.', 'error');
        }
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    console.log('Register button clicked');
    e.preventDefault();
    showLoading();

    // Get form data
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const phone = document.getElementById('reg-phone').value;
    const department = document.getElementById('reg-department').value;
    const position = document.getElementById('reg-position').value;

    // Validate required fields
    if (!name || !email || !password) {
        showToast('Please fill in all required fields', 'error');
        hideLoading();
        return;
    }

    const formData = {
        name,
        email,
        password,
        role,
        phone,
        department,
        position
    };

    console.log('Registration attempt:', { name, email, role });

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        console.log('Registration response status:', response.status);

        const data = await response.json();
        console.log('Registration response data:', data);

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            showToast('Registration successful!', 'success');
            showApp();
        } else {
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Cannot connect to server. Please make sure the server is running.', 'error');
        } else {
            showToast('Network error. Please check your connection and try again.', 'error');
        }
    } finally {
        hideLoading();
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            handleLogout();
        }
    } catch (error) {
        handleLogout();
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showAuth();
}

// UI Functions
function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');

    // Update user info
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-role').textContent = currentUser.role;

    // Show appropriate dashboard
    if (currentUser.role === 'admin') {
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('employee-dashboard').classList.add('hidden');
        loadAdminDashboard();
    } else {
        document.getElementById('employee-dashboard').classList.remove('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
        loadEmployeeDashboard();
    }
}

function showTab(tabName) {
    if (typeof event !== 'undefined' && event && event.preventDefault) event.preventDefault();
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    }

    // Show/hide forms
    document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tabName !== 'register');
}

// Admin Functions
async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateAdminStats(data.stats);
            updateRecentTasks(data.recentTasks);
        }
    } catch (error) {
        showToast('Failed to load dashboard data', 'error');
    }
}

function updateAdminStats(stats) {
    document.getElementById('total-employees').textContent = stats.totalEmployees;
    document.getElementById('total-tasks').textContent = stats.totalTasks;
    document.getElementById('completed-tasks').textContent = stats.completedTasks;
    document.getElementById('pending-tasks').textContent = stats.pendingTasks;
}

function updateRecentTasks(tasks) {
    const container = document.getElementById('recent-tasks-list');
    container.innerHTML = '';

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <div>
                <h5>${task.title}</h5>
                <p>Assigned to: ${task.assignedTo.name}</p>
            </div>
            <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span>
        `;
        container.appendChild(taskItem);
    });
}

function showAdminSection(section) {
    if (typeof event !== 'undefined' && event && event.preventDefault) event.preventDefault();
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    }

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`admin-${section}`).classList.remove('hidden');

    currentSection = section;

    // Load section data
    if (section === 'employees') {
        loadEmployees();
    } else if (section === 'tasks') {
        loadTasks();
    }
}

async function loadEmployees() {
    try {
        const response = await fetch(`${API_BASE}/admin/employees`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const employees = await response.json();
            displayEmployees(employees);
        }
    } catch (error) {
        showToast('Failed to load employees', 'error');
    }
}

function displayEmployees(employees) {
    const tbody = document.getElementById('employees-table-body');
    tbody.innerHTML = '';

    employees.forEach(employee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.name}</td>
            <td>${employee.email}</td>
            <td>${employee.phone || 'N/A'}</td>
            <td>${employee.department || 'N/A'}</td>
            <td>${employee.position || 'N/A'}</td>
            <td><span class="status-badge ${employee.isActive ? 'status-completed' : 'status-pending'}">${employee.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editEmployee('${employee.id || employee._id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${employee.id || employee._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Edit and Delete Employee Handlers
async function editEmployee(employeeId) {
    try {
        // Fetch current employee data
        const resp = await fetch(`${API_BASE}/admin/employees`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!resp.ok) return showToast('Failed to load employee', 'error');
        const list = await resp.json();
        const emp = list.find(e => (e.id || e._id) === employeeId);
        if (!emp) return showToast('Employee not found', 'error');

        const name = prompt('Name:', emp.name || '');
        if (name === null) return;
        const email = prompt('Email:', emp.email || '');
        if (email === null) return;
        const phone = prompt('Phone:', emp.phone || '');
        if (phone === null) return;
        const department = prompt('Department:', emp.department || '');
        if (department === null) return;
        const position = prompt('Position:', emp.position || '');
        if (position === null) return;

        const res = await fetch(`${API_BASE}/admin/employees/${employeeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, email, phone, department, position })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Employee updated successfully', 'success');
            loadEmployees();
        } else {
            showToast(data.message || 'Failed to update employee', 'error');
        }
    } catch (e) {
        showToast('Network error updating employee', 'error');
    }
}

async function deleteEmployee(employeeId) {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
        const res = await fetch(`${API_BASE}/admin/employees/${employeeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('Employee deleted successfully', 'success');
            loadEmployees();
        } else {
            showToast(data.message || 'Failed to delete employee', 'error');
        }
    } catch (e) {
        showToast('Network error deleting employee', 'error');
    }
}

async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE}/admin/tasks`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const tasks = await response.json();
            displayTasks(tasks);
            populateEmployeeFilter(tasks);
        }
    } catch (error) {
        showToast('Failed to load tasks', 'error');
    }
}

function displayTasks(tasks) {
    const tbody = document.getElementById('tasks-table-body');
    tbody.innerHTML = '';

    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title}</td>
            <td>${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}</td>
            <td>${(task.assignedTo && task.assignedTo.name) ? task.assignedTo.name : 'Unassigned'}</td>
            <td><span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></td>
            <td><span class="status-badge priority-${task.priority}">${task.priority}</span></td>
            <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewTaskDetails('${task.id || task._id}')">View</button>
                <button class="btn btn-sm btn-warning" onclick="editTask('${task.id || task._id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id || task._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateEmployeeFilter(tasks) {
    const filter = document.getElementById('task-employee-filter');
    // Reset options except the first
    filter.innerHTML = '<option value="">All Employees</option>';
    const ids = new Set();
    tasks.forEach(t => {
        const assigned = t.assignedTo || {};
        const id = assigned.id || assigned._id;
        if (id && !ids.has(id)) {
            ids.add(id);
            const option = document.createElement('option');
            option.value = id;
            option.textContent = assigned.name || 'Unknown';
            filter.appendChild(option);
        }
    });
}

// Employee Functions
async function loadEmployeeDashboard() {
    try {
        const response = await fetch(`${API_BASE}/employee/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateEmployeeStats(data.stats);
            updateMyRecentTasks(data.recentTasks);
        }
    } catch (error) {
        showToast('Failed to load dashboard data', 'error');
    }
}

function updateEmployeeStats(stats) {
    document.getElementById('my-total-tasks').textContent = stats.totalTasks;
    document.getElementById('my-completed-tasks').textContent = stats.completedTasks;
    document.getElementById('my-pending-tasks').textContent = stats.pendingTasks;
    document.getElementById('my-in-progress-tasks').textContent = stats.inProgressTasks;
}

function updateMyRecentTasks(tasks) {
    const container = document.getElementById('my-recent-tasks-list');
    container.innerHTML = '';

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <div>
                <h5>${task.title}</h5>
                <p>Assigned by: ${task.assignedBy.name}</p>
            </div>
            <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span>
        `;
        container.appendChild(taskItem);
    });
}

function showEmployeeSection(section) {
    if (typeof event !== 'undefined' && event && event.preventDefault) event.preventDefault();
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    }

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`employee-${section}`).classList.remove('hidden');

    currentSection = section;

    // Load section data
    if (section === 'tasks') {
        loadMyTasks();
    } else if (section === 'profile') {
        loadProfile();
    }
}

async function loadMyTasks() {
    try {
        const response = await fetch(`${API_BASE}/employee/tasks`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const tasks = await response.json();
            displayMyTasks(tasks);
        }
    } catch (error) {
        showToast('Failed to load tasks', 'error');
    }
}

function displayMyTasks(tasks) {
    const container = document.getElementById('my-tasks-container');
    container.innerHTML = '';

    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.innerHTML = `
            <h4>${task.title}</h4>
            <p>${task.description}</p>
            <div class="task-meta">
                <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span>
                <span class="status-badge priority-${task.priority}">${task.priority}</span>
            </div>
            <div class="task-actions">
                <select onchange="updateTaskStatus('${task.id || task._id}', this.value)" class="form-control">
                    <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
                <button class="btn btn-sm btn-primary" onclick="viewTaskDetails('${task.id || task._id}')">View Details</button>
            </div>
        `;
        container.appendChild(taskCard);
    });
}

async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE}/employee/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            populateProfileForm(user);
        }
    } catch (error) {
        showToast('Failed to load profile', 'error');
    }
}

function populateProfileForm(user) {
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-department').value = user.department || '';
    document.getElementById('profile-position').value = user.position || '';
}

// Modal Functions
function showAddEmployeeModal() {
    document.getElementById('add-employee-modal').classList.add('show');
}

function showAddTaskModal() {
    loadEmployeesForTask();
    document.getElementById('add-task-modal').classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

async function loadEmployeesForTask() {
    try {
        const response = await fetch(`${API_BASE}/admin/employees`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const employees = await response.json();
            const select = document.getElementById('task-assigned-to');
            select.innerHTML = '<option value="">Select Employee</option>';

            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id || employee._id; // Support both id formats
                option.textContent = employee.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        showToast('Failed to load employees', 'error');
    }
}

// Form Handlers
async function handleAddEmployee(e) {
    e.preventDefault();
    showLoading();

    const formData = {
        name: document.getElementById('emp-name').value,
        email: document.getElementById('emp-email').value,
        password: document.getElementById('emp-password').value,
        phone: document.getElementById('emp-phone').value,
        department: document.getElementById('emp-department').value,
        position: document.getElementById('emp-position').value
    };

    try {
        const response = await fetch(`${API_BASE}/admin/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Employee added successfully!', 'success');
            loadEmployees();
        } else {
            showToast(data.message || 'Failed to add employee', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddTask(e) {
    e.preventDefault();
    showLoading();

    const formData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        assignedTo: document.getElementById('task-assigned-to').value,
        priority: document.getElementById('task-priority').value,
        dueDate: document.getElementById('task-due-date').value
    };

    try {
        const response = await fetch(`${API_BASE}/admin/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Task created successfully!', 'success');
            loadTasks();
        } else {
            showToast(data.message || 'Failed to create task', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    showLoading();

    const formData = {
        name: document.getElementById('profile-name').value,
        phone: document.getElementById('profile-phone').value,
        department: document.getElementById('profile-department').value,
        position: document.getElementById('profile-position').value
    };

    try {
        const response = await fetch(`${API_BASE}/employee/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Profile updated successfully!', 'success');
            currentUser = {...currentUser, ...data.user };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            showToast(data.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Task Management Functions
async function updateTaskStatus(taskId, status) {
    try {
        const response = await fetch(`${API_BASE}/employee/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast('Task status updated!', 'success');
            loadMyTasks();
        } else {
            showToast('Failed to update task status', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function viewTaskDetails(taskId) {
    try {
        const response = await fetch(`${API_BASE}/employee/tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const task = await response.json();
            modalTaskId = taskId;
            showTaskDetailsModal(task);
            await loadTaskAttachments(taskId);
            setupUploadHandler(taskId);
        }
    } catch (error) {
        showToast('Failed to load task details', 'error');
    }
}

function showTaskDetailsModal(task) {
    const content = document.getElementById('task-details-content');
    content.innerHTML = `
        <div class="task-details">
            <h4>${task.title}</h4>
            <p><strong>Description:</strong> ${task.description}</p>
            <p><strong>Assigned by:</strong> ${task.assignedBy.name}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></p>
            <p><strong>Priority:</strong> <span class="status-badge priority-${task.priority}">${task.priority}</span></p>
            <p><strong>Due Date:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
            ${task.notes && task.notes.length > 0 ? `
                <h5>Notes:</h5>
                <div class="notes">
                    ${task.notes.map(note => `
                        <div class="note">
                            <p>${note.text}</p>
                            <small>Added on ${new Date(note.addedAt).toLocaleDateString()}</small>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('task-details-modal').classList.add('show');
}

// Attachments
async function loadTaskAttachments(taskId) {
    try {
        const res = await fetch(`${API_BASE.replace('/api','')}/api/tasks/${taskId}/attachments`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const list = await res.json();
        renderAttachments(list, taskId);
    } catch (e) {
        // ignore
    }
}

function renderAttachments(attachments, taskId) {
    const container = document.getElementById('task-attachments-list');
    container.innerHTML = '';
    if (!attachments || attachments.length === 0) {
        const el = document.createElement('div');
        el.textContent = 'No attachments yet';
        container.appendChild(el);
        return;
    }
    attachments.forEach(a => {
        const row = document.createElement('div');
        row.className = 'task-item';
        row.innerHTML = `
            <div>
                <h5>${a.originalName}</h5>
                <p>${(a.size/1024).toFixed(1)} KB • ${new Date(a.uploadedAt).toLocaleString()}</p>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="downloadAttachment('${taskId}','${a.filename}','${a.originalName}')">Download</button>
        `;
        container.appendChild(row);
    });
}

function setupUploadHandler(taskId) {
    const btn = document.getElementById('task-file-upload-btn');
    if (!btn) return;
    btn.onclick = async (e) => {
        e.preventDefault();
        const input = document.getElementById('task-file-input');
        if (!input || !input.files || !input.files[0]) {
            showToast('Please choose a file to upload', 'warning');
            return;
        }
        const form = new FormData();
        form.append('file', input.files[0]);
        try {
            const res = await fetch(`${API_BASE}/employee/tasks/${taskId}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: form
            });
            const data = await res.json();
            if (res.ok) {
                showToast('File uploaded', 'success');
                input.value = '';
                await loadTaskAttachments(taskId);
            } else {
                showToast(data.message || 'Upload failed', 'error');
            }
        } catch (e) {
            showToast('Network error during upload', 'error');
        }
    };
}

async function downloadAttachment(taskId, filename, originalName) {
    try {
        const res = await fetch(`${API_BASE.replace('/api','')}/api/tasks/${taskId}/attachments/${filename}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            const data = await res.json().catch(()=>({}));
            return showToast(data.message || 'Download failed', 'error');
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        showToast('Network error during download', 'error');
    }
}

// Task Edit and Delete Functions
async function editTask(taskId) {
    console.log('Edit task button clicked for task:', taskId);
    try {
        // Fetch current task data
        const response = await fetch(`${API_BASE}/employee/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return showToast('Failed to load task', 'error');
        const task = await response.json();
        
        // Get updated values from user
        const title = prompt('Task Title:', task.title || '');
        if (title === null) return;
        
        const description = prompt('Task Description:', task.description || '');
        if (description === null) return;
        
        const priority = prompt('Priority (low/medium/high):', task.priority || 'medium');
        if (priority === null) return;
        
        const dueDate = prompt('Due Date (YYYY-MM-DD):', task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
        if (dueDate === null) return;
        
        const status = prompt('Status (pending/in_progress/completed):', task.status || 'pending');
        if (status === null) return;
        
        // Get available employees for assignment
        const empResponse = await fetch(`${API_BASE}/admin/employees`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!empResponse.ok) return showToast('Failed to load employees', 'error');
        const employees = await empResponse.json();
        
        // Show employee selection
        let employeeOptions = 'Select Employee:\n';
        employees.forEach((emp, index) => {
            const isSelected = emp.id === task.assignedTo || emp._id === task.assignedTo;
            employeeOptions += `${index + 1}. ${emp.name}${isSelected ? ' (current)' : ''}\n`;
        });
        
        const selectedEmpIndex = prompt(employeeOptions + '\nEnter number (0 for unassigned):', '0');
        if (selectedEmpIndex === null) return;
        
        let assignedTo = null;
        if (selectedEmpIndex !== '0' && selectedEmpIndex !== '') {
            const empIndex = parseInt(selectedEmpIndex) - 1;
            if (empIndex >= 0 && empIndex < employees.length) {
                assignedTo = employees[empIndex].id || employees[empIndex]._id;
            }
        }
        
        // Update task
        const updateResponse = await fetch(`${API_BASE}/admin/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title,
                description,
                priority,
                dueDate: dueDate || null,
                status,
                assignedTo
            })
        });
        
        const data = await updateResponse.json();
        if (updateResponse.ok) {
            showToast('Task updated successfully', 'success');
            loadTasks();
        } else {
            showToast(data.message || 'Failed to update task', 'error');
        }
    } catch (error) {
        console.error('Edit task error:', error);
        showToast('Network error updating task', 'error');
    }
}

async function deleteTask(taskId) {
    console.log('Delete task button clicked for task:', taskId);
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast('Task deleted successfully', 'success');
            loadTasks();
        } else {
            showToast(data.message || 'Failed to delete task', 'error');
        }
    } catch (error) {
        console.error('Delete task error:', error);
        showToast('Network error deleting task', 'error');
    }
}

// Filter Functions
function filterTasks() {
    const statusFilter = document.getElementById('task-status-filter').value;
    const employeeFilter = document.getElementById('task-employee-filter').value;
    
    // Implement filtering logic here
    loadTasks();
}

function filterMyTasks() {
    const statusFilter = document.getElementById('my-task-status-filter').value;
    
    // Implement filtering logic here
    loadMyTasks();
}

// Utility Functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    // Disabled auto-close when clicking outside a modal to prevent unintended navigation/back behavior
    // Intentionally left blank
});

// Initialize with stored user data if available
const storedUser = localStorage.getItem('currentUser');
if (storedUser) {
    currentUser = JSON.parse(storedUser);
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        checkAuthStatus();
    }
}