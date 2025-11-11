const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');

const app = express();

// Simple JSON-based storage
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const usersFile = path.join(dataDir, 'users.json');
const tasksFile = path.join(dataDir, 'tasks.json');

// Initialize data files
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
}
if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, JSON.stringify([]));
}

// Helper functions for JSON storage
const readUsers = () => {
    try {
        const data = fs.readFileSync(usersFile, 'utf8');
        if (!data || data.trim() === '') {
            return [];
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
};

const writeUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

const readTasks = () => {
    try {
        const data = fs.readFileSync(tasksFile, 'utf8');
        if (!data || data.trim() === '') {
            return [];
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading tasks file:', error);
        return [];
    }
};

const writeTasks = (tasks) => {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
};

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Handle CORS preflight for all routes
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, unique + '-' + safeOriginal);
    }
});
const upload = multer({ storage });

// Simple auth middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization') ? req.header('Authorization').replace('Bearer ', '') : null;
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        const users = readUsers();
        const user = users.find(u => u.id === decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working!', 
        timestamp: new Date().toISOString(),
        status: 'OK'
    });
});

// Auth routes
app.post('/api/auth/register', async(req, res) => {
    try {
        console.log('Registration request received:', req.body);
        
        // Validate required fields
        if (!req.body || !req.body.email || !req.body.password || !req.body.name) {
            return res.status(400).json({ message: 'Missing required fields: name, email, password' });
        }
        
        const { name, email, password, role, phone, department, position } = req.body;

        const users = readUsers();
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword,
            role: role || 'employee',
            phone,
            department,
            position,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeUsers(users);

        const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'your_jwt_secret_key_here', { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                phone: newUser.phone,
                department: newUser.department,
                position: newUser.position
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async(req, res) => {
    try {
        console.log('Login request received:', req.body);
        
        // Validate required fields
        if (!req.body || !req.body.email || !req.body.password) {
            return res.status(400).json({ message: 'Missing required fields: email, password' });
        }
        
        const { email, password } = req.body;
        const users = readUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(400).json({ message: 'Account is deactivated' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your_jwt_secret_key_here', { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                department: user.department,
                position: user.position
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/auth/me', auth, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            phone: req.user.phone,
            department: req.user.department,
            position: req.user.position
        }
    });
});

// Admin routes
app.get('/api/admin/dashboard', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const users = readUsers();
    const tasks = readTasks();

    const totalEmployees = users.filter(u => u.role === 'employee' && u.isActive).length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

    const recentTasks = tasks
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(task => ({
            ...task,
            assignedTo: users.find(u => u.id === task.assignedTo),
            assignedBy: users.find(u => u.id === task.assignedBy)
        }));

    res.json({
        stats: {
            totalEmployees,
            totalTasks,
            completedTasks,
            pendingTasks,
            inProgressTasks
        },
        recentTasks
    });
});

app.get('/api/admin/employees', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const users = readUsers();
    const employees = users.filter(u => u.role === 'employee');
    console.log('Returning employees:', employees.map(e => ({ id: e.id, name: e.name, role: e.role })));
    res.json(employees);
});

app.post('/api/admin/employees', auth, async(req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        const { name, email, password, phone, department, position } = req.body;
        const users = readUsers();

        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword,
            role: 'employee',
            phone,
            department,
            position,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeUsers(users);

        res.status(201).json({
            message: 'Employee created successfully',
            employee: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                department: newUser.department,
                position: newUser.position
            }
        });
    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/admin/tasks', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = readTasks();
    const users = readUsers();

    const tasksWithUsers = tasks.map(task => ({
        ...task,
        assignedTo: users.find(u => u.id === task.assignedTo) || null,
        assignedBy: users.find(u => u.id === task.assignedBy) || null
    }));

    res.json(tasksWithUsers);
});

// Get single task details
app.get('/api/employee/tasks/:id', auth, (req, res) => {
    const { id } = req.params;
    const tasks = readTasks();
    const users = readUsers();
    const task = tasks.find(t => t.id === id || t._id === id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Employees can only access their own tasks; admins can access any
    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const enriched = {
        ...task,
        assignedBy: users.find(u => u.id === task.assignedBy) || null,
        assignedTo: users.find(u => u.id === task.assignedTo) || null
    };
    res.json(enriched);
});

app.post('/api/admin/tasks', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, assignedTo, priority, dueDate } = req.body;
    const tasks = readTasks();
    const users = readUsers();

    console.log('Creating task with assignedTo:', assignedTo);
    console.log('Available users:', users.map(u => ({ id: u.id, name: u.name, role: u.role })));

    const assignedUser = users.find(u => u.id === assignedTo);
    console.log('Found assigned user:', assignedUser);

    if (!assignedUser) {
        return res.status(400).json({
            message: 'Employee not found. Please select a valid employee.',
            availableEmployees: users.filter(u => u.role === 'employee').map(u => ({ id: u.id, name: u.name }))
        });
    }

    if (assignedUser.role !== 'employee') {
        return res.status(400).json({ message: 'Selected user is not an employee' });
    }

    const newTask = {
        id: Date.now().toString(),
        title,
        description,
        assignedTo,
        assignedBy: req.user.id,
        status: 'pending',
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        createdAt: new Date().toISOString(),
        notes: [],
        attachments: []
    };

    tasks.push(newTask);
    writeTasks(tasks);

    const taskWithUser = {
        ...newTask,
        assignedTo: assignedUser
    };

    res.status(201).json({
        message: 'Task created successfully',
        task: taskWithUser
    });
});

// Update task (admin)
app.put('/api/admin/tasks/:id', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { title, description, assignedTo, priority, dueDate, status } = req.body;
    console.log('PUT /api/admin/tasks/:id', { id, body: req.body, user: { id: req.user.id, role: req.user.role } });
    const tasks = readTasks();
    const users = readUsers();
    const idx = tasks.findIndex(t => t.id === id || t._id === id);
    if (idx === -1) return res.status(404).json({ message: 'Task not found' });

    if (assignedTo) {
        const user = users.find(u => u.id === assignedTo);
        if (!user || user.role !== 'employee') {
            return res.status(400).json({ message: 'Invalid assignee' });
        }
        tasks[idx].assignedTo = assignedTo;
    }

    if (title !== undefined) tasks[idx].title = title;
    if (description !== undefined) tasks[idx].description = description;
    if (priority !== undefined) tasks[idx].priority = priority;
    if (dueDate !== undefined) tasks[idx].dueDate = dueDate ? new Date(dueDate).toISOString() : null;
    if (status !== undefined) {
        tasks[idx].status = status;
        if (status === 'completed') tasks[idx].completedAt = new Date().toISOString();
    }

    writeTasks(tasks);
    const task = tasks[idx];
    const response = {
        ...task,
        assignedTo: users.find(u => u.id === task.assignedTo) || null,
        assignedBy: users.find(u => u.id === task.assignedBy) || null
    };
    res.json({ message: 'Task updated successfully', task: response });
});

// Delete task (admin)
app.delete('/api/admin/tasks/:id', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    console.log('DELETE /api/admin/tasks/:id', { id, user: { id: req.user.id, role: req.user.role } });
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id || t._id === id);
    if (idx === -1) return res.status(404).json({ message: 'Task not found' });

    tasks.splice(idx, 1);
    writeTasks(tasks);
    res.json({ message: 'Task deleted successfully' });
});

// Employee routes
app.get('/api/employee/dashboard', auth, (req, res) => {
    const tasks = readTasks();
    const userTasks = tasks.filter(t => t.assignedTo === req.user.id);

    const totalTasks = userTasks.length;
    const completedTasks = userTasks.filter(t => t.status === 'completed').length;
    const pendingTasks = userTasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = userTasks.filter(t => t.status === 'in_progress').length;

    const recentTasks = userTasks
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(task => ({
            ...task,
            assignedBy: readUsers().find(u => u.id === task.assignedBy)
        }));

    res.json({
        stats: {
            totalTasks,
            completedTasks,
            pendingTasks,
            inProgressTasks
        },
        recentTasks
    });
});

app.get('/api/employee/tasks', auth, (req, res) => {
    const tasks = readTasks();
    const users = readUsers();
    const userTasks = tasks.filter(t => t.assignedTo === req.user.id);

    const tasksWithUsers = userTasks.map(task => ({
        ...task,
        assignedBy: users.find(u => u.id === task.assignedBy) || null
    }));

    res.json(tasksWithUsers);
});

app.put('/api/employee/tasks/:id/status', auth, (req, res) => {
    const { status } = req.body;
    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => (t.id === req.params.id || t._id === req.params.id) && t.assignedTo === req.user.id);

    if (taskIndex === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }

    tasks[taskIndex].status = status;
    if (status === 'completed') {
        tasks[taskIndex].completedAt = new Date().toISOString();
    }

    writeTasks(tasks);
    res.json({ message: 'Task status updated successfully' });
});

// List task attachments (admin or assigned employee)
app.get('/api/tasks/:id/attachments', auth, (req, res) => {
    const { id } = req.params;
    const tasks = readTasks();
    const task = tasks.find(t => t.id === id || t._id === id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const attachments = Array.isArray(task.attachments) ? task.attachments : [];
    res.json(attachments);
});

// Upload a file to task (assigned employee or admin)
app.post('/api/employee/tasks/:id/upload', auth, upload.single('file'), (req, res) => {
    const { id } = req.params;
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id || t._id === id);
    if (idx === -1) return res.status(404).json({ message: 'Task not found' });

    const task = tasks[idx];
    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    if (!Array.isArray(task.attachments)) task.attachments = [];
    const attachment = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.id
    };
    task.attachments.push(attachment);
    tasks[idx] = task;
    writeTasks(tasks);

    res.status(201).json({ message: 'File uploaded successfully', attachment });
});

// Download a specific attachment (admin or assigned employee)
app.get('/api/tasks/:id/attachments/:filename', auth, (req, res) => {
    const { id, filename } = req.params;
    const tasks = readTasks();
    const task = tasks.find(t => t.id === id || t._id === id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const attachments = Array.isArray(task.attachments) ? task.attachments : [];
    const found = attachments.find(a => a.filename === filename);
    if (!found) return res.status(404).json({ message: 'File not found for this task' });

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Stored file missing on server' });
    }

    res.download(filePath, found.originalName);
});

app.get('/api/employee/profile', auth, (req, res) => {
    res.json(req.user);
});

app.put('/api/employee/profile', auth, (req, res) => {
    const { name, phone, department, position } = req.body;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex !== -1) {
        users[userIndex].name = name || users[userIndex].name;
        users[userIndex].phone = phone;
        users[userIndex].department = department;
        users[userIndex].position = position;
        writeUsers(users);

        req.user = users[userIndex];
        res.json({ message: 'Profile updated successfully', user: req.user });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Create sample data if none exists
const initializeSampleData = () => {
    const users = readUsers();
    let changed = false;

    // Ensure sample admin exists
    if (!users.find(u => u.email === 'admin@example.com')) {
        console.log('Ensuring sample admin user exists...');
        const sampleAdmin = {
            id: '1',
            name: 'Admin User',
            email: 'admin@example.com',
            password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
            role: 'admin',
            phone: '123-456-7890',
            department: 'IT',
            position: 'System Administrator',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(sampleAdmin);
        console.log('Sample admin created: admin@example.com / password: password');
        changed = true;
    }

    // Ensure demo employee exists for quick login
    const existingDemo = users.find(u => u.email === 'farhanibushe@gmail.com');
    if (!existingDemo) {
        console.log('Ensuring demo employee user exists...');
        const sampleEmployee = {
            id: Date.now().toString(),
            name: 'Farhani Bushe',
            email: 'farhanibushe@gmail.com',
            password: bcrypt.hashSync('12345678', 10),
            role: 'employee',
            phone: '000-000-0000',
            department: 'General',
            position: 'Staff',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(sampleEmployee);
        console.log('Sample employee created: farhanibushe@gmail.com / password: 12345678');
        changed = true;
    } else {
        // Only reset password / activate if needed (avoid unnecessary writes)
        const passwordMatches = bcrypt.compareSync('12345678', existingDemo.password);
        if (!passwordMatches || !existingDemo.isActive) {
            existingDemo.password = bcrypt.hashSync('12345678', 10);
            existingDemo.isActive = true;
            console.log('Sample employee password reset to 12345678 and activated');
            changed = true;
        }
    }

    if (changed) {
        writeUsers(users);
    }
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
    console.log('Using simple JSON storage (no MongoDB required)');
    initializeSampleData();
});
