// Supabase configuration
const SUPABASE_URL = 'https://jvwqmjtbttpyybhmpgnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3FtanRidHRweXliaG1wZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTMwMzAsImV4cCI6MjA3NTA4OTAzMH0.VW0zTnCxi0X2ZTKVWZ_H_CvQynqmP-7maDFkKhZVEcs';

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
    console.error('Error initializing Supabase client:', error);
}

// Global variables
let currentUserData = null;
let currentInstituteData = null;
let currentTeacherData = null;
let currentStudentData = null;
let userRole = null;

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const supabaseError = document.getElementById('supabaseError');
    const userName = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    const roleBadge = document.getElementById('roleBadge');
    const profileHeader = document.getElementById('profileHeader');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileNavItem = document.getElementById('profileNavItem');
    const actionButtons = document.getElementById('actionButtons');

    // Initialize the page
    initializePage();

    async function initializePage() {
        await testSupabaseConnection();
        await loadUserData();
    }

    // Test Supabase connection
    async function testSupabaseConnection() {
        if (!supabase) {
            showSupabaseError('Connection error: Please refresh the page');
            return;
        }
        
        try {
            const { data, error } = await supabase.from('users').select('count').limit(1);
            if (error) throw error;
            hideSupabaseError();
        } catch (error) {
            console.error('Supabase connection test failed:', error);
            showSupabaseError('Failed to connect to server. Please try again later.');
        }
    }

    function showSupabaseError(message) {
        supabaseError.style.display = 'flex';
        document.getElementById('supabaseErrorText').textContent = message;
    }

    function hideSupabaseError() {
        supabaseError.style.display = 'none';
    }

    // Load user data and determine role
    async function loadUserData() {
        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            // Get user data from users table
            const { data: userData, error: userDataError } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', user.id)
                .single();

            if (userDataError) throw userDataError;
            currentUserData = userData;
            userRole = userData.role;

            // Display user data
            displayUserData(userData);

            // Load additional data based on role
            if (userRole === 'admin') {
                await loadAdminData(userData);
            } else if (userRole === 'teacher') {
                await loadTeacherData(userData);
            } else if (userRole === 'student') {
                await loadStudentData(userData);
            } else {
                // For other roles, show basic profile
                displayBasicProfile(userData);
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            showSupabaseError('Error loading profile data: ' + error.message);
        }
    }

    // Display user data in header
    function displayUserData(user) {
        userName.textContent = user.full_name;
        userRoleElement.textContent = `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Profile`;
        
        // Set role badge
        roleBadge.textContent = user.role.toUpperCase();
        
        // Apply role-specific styling
        if (user.role === 'teacher') {
            profileHeader.classList.add('teacher-header');
            userAvatar.classList.add('teacher-avatar');
            editProfileBtn.classList.remove('btn-primary');
            editProfileBtn.classList.add('teacher-btn-primary');
            profileNavItem.classList.add('teacher-nav-item');
        } else if (user.role === 'student') {
            profileHeader.classList.add('student-header');
            userAvatar.classList.add('student-avatar');
            editProfileBtn.classList.remove('btn-primary');
            editProfileBtn.classList.add('student-btn-primary');
            profileNavItem.classList.add('student-nav-item');
            
            // Hide edit button for students
            editProfileBtn.style.display = 'none';
        }
        
        // User avatar
        if (user.profile_photo_url) {
            userAvatar.innerHTML = `<img src="${user.profile_photo_url}" alt="${user.full_name}" onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder').style.display='flex';" />`;
            const placeholder = userAvatar.querySelector('.placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    // Load admin-specific data
    async function loadAdminData(userData) {
        try {
            // Get institute data
            const { data: instituteData, error: instituteError } = await supabase
                .from('admin_institutes')
                .select('*')
                .eq('user_id', userData.user_id)
                .single();

            if (instituteError) {
                if (instituteError.code === 'PGRST116') {
                    // No institute found - admin hasn't set up institute
                    showNoInstituteData();
                    return;
                }
                throw instituteError;
            }

            currentInstituteData = instituteData;
            displayAdminProfile(userData, instituteData);
            
        } catch (error) {
            console.error('Error loading admin data:', error);
            showSupabaseError('Error loading admin data: ' + error.message);
        }
    }

    // Load teacher-specific data
    async function loadTeacherData(userData) {
        try {
            // Get teacher data from teacher_institutes table
            const { data: teacherData, error: teacherError } = await supabase
                .from('teacher_institutes')
                .select('*')
                .eq('user_id', userData.user_id)
                .single();

            if (teacherError) {
                console.error('Error loading teacher data:', teacherError);
                // Teacher might not be associated with an institute yet
                displayTeacherProfile(userData, null);
                return;
            }

            currentTeacherData = teacherData;

            // Get institute data using institute_code
            const { data: instituteData, error: instituteError } = await supabase
                .from('admin_institutes')
                .select('*')
                .eq('institute_code', teacherData.institute_code)
                .single();

            if (instituteError) {
                console.error('Error loading institute data for teacher:', instituteError);
                // Institute not found or error
                displayTeacherProfile(userData, null, teacherData);
                return;
            }

            currentInstituteData = instituteData;
            displayTeacherProfile(userData, instituteData, teacherData);
            
        } catch (error) {
            console.error('Error loading teacher data:', error);
            showSupabaseError('Error loading teacher data: ' + error.message);
        }
    }

    // Load student-specific data
    async function loadStudentData(userData) {
        try {
            // Get student data from student_institutes table
            const { data: studentData, error: studentError } = await supabase
                .from('student_institutes')
                .select('*')
                .eq('user_id', userData.user_id)
                .single();

            if (studentError) {
                console.error('Error loading student data:', studentError);
                // Student might not be associated with an institute yet
                displayStudentProfile(userData, null);
                return;
            }

            currentStudentData = studentData;

            // Get institute data using institute_code
            const { data: instituteData, error: instituteError } = await supabase
                .from('admin_institutes')
                .select('*')
                .eq('institute_code', studentData.institute_code)
                .single();

            if (instituteError) {
                console.error('Error loading institute data for student:', instituteError);
                // Institute not found or error
                displayStudentProfile(userData, null, studentData);
                return;
            }

            currentInstituteData = instituteData;
            displayStudentProfile(userData, instituteData, studentData);
            
        } catch (error) {
            console.error('Error loading student data:', error);
            showSupabaseError('Error loading student data: ' + error.message);
        }
    }

    // Display admin profile
    function displayAdminProfile(user, institute) {
        // Personal Details
        const personalDetails = document.getElementById('personalDetails');
        personalDetails.innerHTML = `
            <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${user.full_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone Number</span>
                <span class="info-value">${user.phone}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">User ID</span>
                <span class="info-value">${user.user_id}</span>
            </div>
        `;

        // Institute Details
        const instituteDetails = document.getElementById('instituteDetails');
        instituteDetails.innerHTML = `
            <div class="info-item">
                <span class="info-label">Institute Name</span>
                <span class="info-value">${institute.institute_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Institute Type</span>
                <span class="info-value">${institute.institute_type ? institute.institute_type.charAt(0).toUpperCase() + institute.institute_type.slice(1) : 'Not specified'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Registration Number</span>
                <span class="info-value">${institute.registration_number || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Address</span>
                <span class="info-value">${institute.address || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">City</span>
                <span class="info-value">${institute.city || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">State</span>
                <span class="info-value">${institute.state || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Contact Number</span>
                <span class="info-value">${institute.contact_number || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${institute.email || 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Website</span>
                <span class="info-value">${institute.website ? `<a href="${institute.website}" target="_blank">${institute.website}</a>` : 'Not provided'}</span>
            </div>
        `;

        // Show institute code section for admin
        document.getElementById('codeSection').style.display = 'block';
        document.getElementById('instituteCodeDisplay').textContent = institute.institute_code || 'NOT SET';
    }

    // Display teacher profile
    function displayTeacherProfile(user, institute, teacherData) {
        // Personal Details
        const personalDetails = document.getElementById('personalDetails');
        personalDetails.innerHTML = `
            <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${user.full_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone Number</span>
                <span class="info-value">${user.phone}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Date of Birth</span>
                <span class="info-value">${teacherData ? (teacherData.date_of_birth ? new Date(teacherData.date_of_birth).toLocaleDateString() : 'Not provided') : 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Gender</span>
                <span class="info-value">${teacherData ? (teacherData.gender ? teacherData.gender.charAt(0).toUpperCase() + teacherData.gender.slice(1) : 'Not provided') : 'Not provided'}</span>
            </div>
        `;

        // Institute Details
        const instituteDetails = document.getElementById('instituteDetails');
        if (institute) {
            instituteDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Institute Name</span>
                    <span class="info-value">${institute.institute_name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Institute Type</span>
                    <span class="info-value">${institute.institute_type ? institute.institute_type.charAt(0).toUpperCase() + institute.institute_type.slice(1) : 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Address</span>
                    <span class="info-value">${institute.address || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">City</span>
                    <span class="info-value">${institute.city || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Contact Number</span>
                    <span class="info-value">${institute.contact_number || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-value">${institute.email || 'Not provided'}</span>
                </div>
            `;
        } else {
            instituteDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Institute Status</span>
                    <span class="info-value">Not associated with any institute</span>
                </div>
            `;
        }

        // Professional Details (Teacher Only)
        if (teacherData) {
            document.getElementById('professionalSection').style.display = 'block';
            const professionalDetails = document.getElementById('professionalDetails');
            professionalDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Qualification</span>
                    <span class="info-value">${teacherData.qualification || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Specialization</span>
                    <span class="info-value">${teacherData.specialization || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Experience</span>
                    <span class="info-value">${teacherData.experience_years || 0} years</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Subjects</span>
                    <span class="info-value">${teacherData.subjects_taught || 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Available Hours</span>
                    <span class="info-value">${teacherData.available_hours || 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Joining Date</span>
                    <span class="info-value">${teacherData.joining_date ? new Date(teacherData.joining_date).toLocaleDateString() : 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value">
                        ${teacherData.status ? teacherData.status.charAt(0).toUpperCase() + teacherData.status.slice(1) : 'Unknown'}
                        <span class="status-badge ${teacherData.status === 'pending' ? 'status-pending' : 'status-confirmed'}">
                            ${teacherData.status === 'pending' ? 'Pending Approval' : 'Confirmed'}
                        </span>
                    </span>
                </div>
            `;
        }

        // Apply teacher styling to institute code section if needed
        if (institute && teacherData && teacherData.status === 'confirmed') {
            document.getElementById('codeSection').style.display = 'block';
            document.getElementById('instituteCodeContainer').classList.add('teacher-institute-code');
            document.getElementById('instituteCodeDisplay').textContent = institute.institute_code || 'NOT SET';
            document.getElementById('codeSection').querySelector('.section-title').classList.add('teacher-section-title');
            document.querySelector('.code-hint').textContent = 'Institute code for student registration';
        }
    }

    // Display student profile
    function displayStudentProfile(user, institute, studentData) {
        // Personal Details
        const personalDetails = document.getElementById('personalDetails');
        personalDetails.innerHTML = `
            <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${user.full_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone Number</span>
                <span class="info-value">${user.phone}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Date of Birth</span>
                <span class="info-value">${studentData ? (studentData.date_of_birth ? new Date(studentData.date_of_birth).toLocaleDateString() : 'Not provided') : 'Not provided'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Gender</span>
                <span class="info-value">${studentData ? (studentData.gender ? studentData.gender.charAt(0).toUpperCase() + studentData.gender.slice(1) : 'Not provided') : 'Not provided'}</span>
            </div>
        `;

        // Institute Details
        const instituteDetails = document.getElementById('instituteDetails');
        if (institute) {
            instituteDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Institute Name</span>
                    <span class="info-value">${institute.institute_name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Institute Type</span>
                    <span class="info-value">${institute.institute_type ? institute.institute_type.charAt(0).toUpperCase() + institute.institute_type.slice(1) : 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Address</span>
                    <span class="info-value">${institute.address || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">City</span>
                    <span class="info-value">${institute.city || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Contact Number</span>
                    <span class="info-value">${institute.contact_number || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-value">${institute.email || 'Not provided'}</span>
                </div>
            `;
        } else {
            instituteDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Institute Status</span>
                    <span class="info-value">Not associated with any institute</span>
                </div>
            `;
        }

        // Student Details
        if (studentData) {
            document.getElementById('studentSection').style.display = 'block';
            const studentDetails = document.getElementById('studentDetails');
            studentDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Current Class</span>
                    <span class="info-value">${studentData.current_class || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Roll Number</span>
                    <span class="info-value">${studentData.roll_number || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Section</span>
                    <span class="info-value">${studentData.section || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Academic Year</span>
                    <span class="info-value">${studentData.academic_year || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Subjects</span>
                    <span class="info-value">${studentData.subjects || 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Admission Date</span>
                    <span class="info-value">${studentData.admission_date ? new Date(studentData.admission_date).toLocaleDateString() : 'Not specified'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Previous School</span>
                    <span class="info-value">${studentData.previous_school || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Medical Information</span>
                    <span class="info-value">${studentData.medical_info || 'None'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value">
                        ${studentData.status ? studentData.status.charAt(0).toUpperCase() + studentData.status.slice(1) : 'Unknown'}
                        <span class="status-badge ${studentData.status === 'pending' ? 'status-pending' : 'status-confirmed'}">
                            ${studentData.status === 'pending' ? 'Pending Approval' : 'Confirmed'}
                        </span>
                    </span>
                </div>
            `;

            // Parent Information
            document.getElementById('parentSection').style.display = 'block';
            const parentDetails = document.getElementById('parentDetails');
            parentDetails.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Father's Name</span>
                    <span class="info-value">${studentData.father_name || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Mother's Name</span>
                    <span class="info-value">${studentData.mother_name || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Father's Phone</span>
                    <span class="info-value">${studentData.father_phone || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Mother's Phone</span>
                    <span class="info-value">${studentData.mother_phone || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Guardian Name</span>
                    <span class="info-value">${studentData.guardian_name || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Guardian Phone</span>
                    <span class="info-value">${studentData.guardian_phone || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Parent Email</span>
                    <span class="info-value">${studentData.parent_email || 'Not provided'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Emergency Contact</span>
                    <span class="info-value">${studentData.emergency_contact || 'Not provided'}</span>
                </div>
            `;
        }

        // Apply student styling to institute code section if needed
        if (institute && studentData && studentData.status === 'confirmed') {
            document.getElementById('codeSection').style.display = 'block';
            document.getElementById('instituteCodeContainer').classList.add('student-institute-code');
            document.getElementById('instituteCodeDisplay').textContent = institute.institute_code || 'NOT SET';
            document.getElementById('codeSection').querySelector('.section-title').classList.add('student-section-title');
            document.querySelector('.code-hint').textContent = 'Institute code';
        }
    }

    // Display basic profile for other roles
    function displayBasicProfile(user) {
        const personalDetails = document.getElementById('personalDetails');
        personalDetails.innerHTML = `
            <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${user.full_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone Number</span>
                <span class="info-value">${user.phone}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">User ID</span>
                <span class="info-value">${user.user_id}</span>
            </div>
        `;

        // Hide institute section
        document.getElementById('instituteSection').style.display = 'none';
    }

    // Show no institute data state for admin
    function showNoInstituteData() {
        userName.textContent = currentUserData.full_name;
        userRoleElement.textContent = 'Admin Profile - Setup Required';
        
        const profileContent = document.querySelector('.profile-content');
        profileContent.innerHTML = `
            <div class="no-data">
                <i class="fas fa-university"></i>
                <h3>No Institute Setup</h3>
                <p>You haven't setup an institute yet. Please setup your institute to access admin features.</p>
                <br>
                <a href="setup-institute.html" style="
                    display: inline-block;
                    background: var(--primary-blue);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 500;
                ">Setup Institute</a>
            </div>
        `;
    }
});

// Logout functions
function showLogoutConfirmation() {
    document.getElementById('logoutModal').style.display = 'flex';
}

function hideLogoutConfirmation() {
    document.getElementById('logoutModal').style.display = 'none';
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Error logging out: ' + error.message);
    }
}

// Edit profile function
function editProfile() {
    if (userRole === 'admin') {
        if (currentInstituteData) {
            // Redirect to edit institute page
            window.location.href = `edit-institute.html?id=${currentInstituteData.id}`;
        } else {
            // Redirect to setup institute page
            window.location.href = 'setup-institute.html';
        }
    } else if (userRole === 'teacher') {
        // Redirect to edit teacher profile page
        window.location.href = 'edit-teacher-profile.html';
    } else {
        // Redirect to edit student profile page (though students can't edit)
        window.location.href = 'edit-student-profile.html';
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('logoutModal');
    if (event.target === modal) {
        hideLogoutConfirmation();
    }
});