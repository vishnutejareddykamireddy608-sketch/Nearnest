import { useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { UserProfile, JobPosting, JobApplication, UserRole, CompanyReview } from './types';
import { cn } from './lib/utils';
import { 
  Briefcase, 
  Search, 
  Plus, 
  User as UserIcon, 
  LogOut, 
  MapPin, 
  Clock, 
  DollarSign,
  ChevronRight,
  MoreVertical,
  Info,
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
  AlertTriangle,
  Star,
  Mail,
  Phone,
  MessageCircle,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Error Boundary Component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorDetails(event.error?.message || 'An unexpected error occurred');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
          <p className="text-slate-600">
            We encountered an error while processing your request. This might be due to a connection issue or a configuration error.
          </p>
          {errorDetails && (
            <div className="p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-500 break-all text-left">
              {errorDetails}
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <NearnestApp />
    </ErrorBoundary>
  );
}

function NearnestApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [myApplications, setMyApplications] = useState<JobApplication[]>([]);
  const [employerApplications, setEmployerApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'browse' | 'dashboard' | 'post-job' | 'profile' | 'employer-profile' | 'role-selection' | 'about'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isNearMeFilter, setIsNearMeFilter] = useState(false);
  const [postingLocation, setPostingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [selectedEmployerProfile, setSelectedEmployerProfile] = useState<UserProfile | null>(null);
  const [employerReviews, setEmployerReviews] = useState<CompanyReview[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('All');
  const [salaryFilter, setSalaryFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [isApplying, setIsApplying] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'employer' | null>(null);
  const [studentForm, setStudentForm] = useState({
    whatsappNumber: '',
    gender: '' as 'Male' | 'Female' | 'Others' | '',
  });
  const [applyForm, setApplyForm] = useState({
    name: '',
    address: '',
    mobile: '',
    email: '',
    studyInfo: '',
  });
  const [verification, setVerification] = useState({
    mobileOtp: '',
    emailCode: '',
    isMobileSent: false,
    isEmailSent: false,
    isMobileVerified: false,
    isEmailVerified: false,
    generatedMobileOtp: '',
    generatedEmailCode: '',
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Fetch or create profile
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // New users must select a role
            setProfile(null);
            setView('role-selection');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
        setMyApplications([]);
        setEmployerApplications([]);
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Employer profile fetcher
  useEffect(() => {
    if (view === 'employer-profile' && selectedEmployerId) {
      const fetchEmployer = async () => {
        try {
          const docRef = doc(db, 'users', selectedEmployerId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSelectedEmployerProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${selectedEmployerId}`);
        }
      };
      fetchEmployer();

      // Fetch reviews
      const reviewsPath = 'reviews';
      const q = query(collection(db, reviewsPath), where('employerId', '==', selectedEmployerId), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyReview));
        setEmployerReviews(reviewsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, reviewsPath);
      });
      return () => unsubscribe();
    } else {
      setSelectedEmployerProfile(null);
      setEmployerReviews([]);
    }
  }, [view, selectedEmployerId]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Radius of the earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsNearMeFilter(true);
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your location. Please check your browser permissions.");
        }
      );
    }
  };

  const handleGetPostingLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPostingLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location", error);
        }
      );
    }
  };

  // Jobs listener
  useEffect(() => {
    const path = 'jobs';
    const q = query(collection(db, path), where('status', '==', 'open'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobPosting));
      setJobs(jobsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

  // Applications listener (Student)
  useEffect(() => {
    if (user && profile?.role === 'student') {
      const path = 'applications';
      const q = query(collection(db, path), where('studentId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobApplication));
        setMyApplications(appsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [user, profile]);

  // Applications listener (Employer)
  useEffect(() => {
    if (user && profile?.role === 'employer') {
      const path = 'applications';
      const q = query(collection(db, path), where('employerId', '==', user.uid));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobApplication));
        setEmployerApplications(appsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [user, profile]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handlePostJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || profile?.role !== 'employer') return;

    const formData = new FormData(e.currentTarget);
    const jobData = {
      employerId: user.uid,
      employerName: profile.displayName,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      location: formData.get('location') as string,
      latitude: postingLocation?.lat || null,
      longitude: postingLocation?.lng || null,
      type: formData.get('type') as any,
      salary: formData.get('salary') as string,
      salaryMin: Number(formData.get('salaryMin')) || null,
      salaryMax: Number(formData.get('salaryMax')) || null,
      experienceMin: Number(formData.get('experienceMin')) || null,
      experienceMax: Number(formData.get('experienceMax')) || null,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string,
      whatsappNumber: formData.get('whatsappNumber') as string,
      status: 'open',
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'jobs'), jobData);
      setPostingLocation(null);
      setView('browse');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'jobs');
    }
  };

  const sendMobileOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerification(prev => ({ ...prev, generatedMobileOtp: code, isMobileSent: true }));
    alert(`[MOCK SMS] Your OTP for mobile verification is: ${code}`);
  };

  const sendEmailCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerification(prev => ({ ...prev, generatedEmailCode: code, isEmailSent: true }));
    alert(`[MOCK EMAIL] Your verification code is: ${code}`);
  };

  const verifyMobile = () => {
    if (verification.mobileOtp === verification.generatedMobileOtp) {
      setVerification(prev => ({ ...prev, isMobileVerified: true }));
      alert("Mobile number verified!");
    } else {
      alert("Invalid OTP");
    }
  };

  const verifyEmail = () => {
    if (verification.emailCode === verification.generatedEmailCode) {
      setVerification(prev => ({ ...prev, isEmailVerified: true }));
      alert("Email address verified!");
    } else {
      alert("Invalid verification code");
    }
  };

  const handleApply = async (jobId: string, employerId: string) => {
    if (!user || profile?.role !== 'student') return;
    if (!verification.isMobileVerified || !verification.isEmailVerified) {
      alert("Please verify your mobile and email first.");
      return;
    }

    const applicationData = {
      jobId,
      employerId,
      studentId: user.uid,
      studentName: applyForm.name,
      address: applyForm.address,
      mobileNumber: applyForm.mobile,
      email: applyForm.email,
      studyInfo: applyForm.studyInfo,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'applications'), applicationData);
      setSelectedJob(null);
      setIsApplying(false);
      setApplyForm({ name: '', address: '', mobile: '', email: '', studyInfo: '' });
      setVerification({
        mobileOtp: '',
        emailCode: '',
        isMobileSent: false,
        isEmailSent: false,
        isMobileVerified: false,
        isEmailVerified: false,
        generatedMobileOtp: '',
        generatedEmailCode: '',
      });
      alert("Application submitted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'applications');
    }
  };

  const seedVijayawadaJobs = async () => {
    if (!user || profile?.role !== 'employer') return;

    const sampleJobs = [
      {
        title: "Software Engineer Intern",
        employerName: "TechSol Vijayawada",
        description: "Looking for a passionate Software Engineer Intern to join our team in Vijayawada. You will work on exciting web applications using React and Node.js.",
        location: "Benz Circle, Vijayawada",
        latitude: 16.5062,
        longitude: 80.6480,
        type: "Internship",
        salary: "₹15,000 - ₹20,000 per month",
        status: "open",
      },
      {
        title: "Marketing Executive",
        employerName: "RetailHub",
        description: "RetailHub is seeking a dynamic Marketing Executive to handle our local campaigns in Vijayawada. Experience in digital marketing is a plus.",
        location: "MG Road, Vijayawada",
        latitude: 16.5150,
        longitude: 80.6321,
        type: "Full-time",
        salary: "₹25,000 - ₹35,000 per month",
        status: "open",
      },
      {
        title: "Data Entry Specialist",
        employerName: "InfoSystems",
        description: "Join InfoSystems as a Data Entry Specialist. Accuracy and speed are key requirements for this role.",
        location: "Gannavaram, Vijayawada",
        latitude: 16.5411,
        longitude: 80.7961,
        type: "Part-time",
        salary: "₹10,000 - ₹12,000 per month",
        status: "open",
      },
      {
        title: "Content Writer",
        employerName: "CreativeEdge",
        description: "CreativeEdge is looking for a Content Writer to create engaging blog posts and social media content for our clients.",
        location: "Governorpet, Vijayawada",
        latitude: 16.5122,
        longitude: 80.6255,
        type: "Freelance",
        salary: "₹5,000 - ₹8,000 per project",
        status: "open",
      },
      {
        title: "Math Coaching",
        employerName: "Elite Academy",
        description: "Experienced Math Coach needed for high school students. Daily 7hrs commitment required.",
        location: "Labbipet, Vijayawada",
        latitude: 16.5085,
        longitude: 80.6350,
        type: "Part-time",
        salary: "₹20,000 per month",
        status: "open",
      },
      {
        title: "Physics Coaching",
        employerName: "Science Hub",
        description: "Passionate Physics Coach required for competitive exam preparation. Daily 8hrs commitment required.",
        location: "Patamata, Vijayawada",
        latitude: 16.4980,
        longitude: 80.6550,
        type: "Part-time",
        salary: "₹70,000 per month",
        status: "open",
      }
    ];

    try {
      for (const job of sampleJobs) {
        await addDoc(collection(db, 'jobs'), {
          ...job,
          employerId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      alert("Successfully added sample jobs for Vijayawada!");
      setView('browse');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'jobs');
    }
  };

  const updateApplicationStatus = async (appId: string, status: JobApplication['status']) => {
    try {
      await updateDoc(doc(db, 'applications', appId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `applications/${appId}`);
    }
  };

  const handleLeaveReview = async () => {
    if (!user || !selectedEmployerId || reviewRating === 0 || !reviewComment.trim()) return;

    const reviewData = {
      employerId: selectedEmployerId,
      studentId: user.uid,
      studentName: profile?.displayName || 'Anonymous',
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'reviews'), reviewData);
      setReviewRating(0);
      setReviewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    }
  };

  const averageRating = employerReviews.length > 0
    ? (employerReviews.reduce((acc, r) => acc + r.rating, 0) / employerReviews.length).toFixed(1)
    : null;

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.employerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = jobTypeFilter === 'All' || job.type === jobTypeFilter;

    let matchesSalary = true;
    if (salaryFilter !== 'All') {
      const salaryNum = parseInt(job.salary?.replace(/[^0-9]/g, '') || '0');
      if (salaryFilter === '0-20k') matchesSalary = salaryNum <= 20000;
      else if (salaryFilter === '20k-50k') matchesSalary = salaryNum > 20000 && salaryNum <= 50000;
      else if (salaryFilter === '50k+') matchesSalary = salaryNum > 50000;
    }

    let matchesDate = true;
    if (dateFilter !== 'All' && job.createdAt?.seconds) {
      const now = new Date().getTime();
      const jobDate = job.createdAt.seconds * 1000;
      const diffHours = (now - jobDate) / (1000 * 60 * 60);
      if (dateFilter === 'Last 24h') matchesDate = diffHours <= 24;
      else if (dateFilter === 'Last 7 days') matchesDate = diffHours <= 24 * 7;
      else if (dateFilter === 'Last 30 days') matchesDate = diffHours <= 24 * 30;
    }
    
    const matchesNearMe = !isNearMeFilter || !userLocation || !job.latitude || !job.longitude || 
      getDistance(userLocation.lat, userLocation.lng, job.latitude, job.longitude) < 50;
    
    return matchesSearch && matchesType && matchesSalary && matchesDate && matchesNearMe;
  });

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (view === 'role-selection' && user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <UserIcon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Choose Your Account Type</h2>
          <p className="text-slate-500 mb-8">This selection is permanent. You will not be able to change this later.</p>
          
          {!selectedRole ? (
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setSelectedRole('student')}
                className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-slate-900 group-hover:text-indigo-700">Student</span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <p className="text-sm text-slate-500">I am looking for job opportunities and want to apply.</p>
              </button>

              <button 
                onClick={async () => {
                  try {
                    const newProfile: UserProfile = {
                      uid: user.uid,
                      displayName: user.displayName || 'Anonymous',
                      email: user.email || '',
                      role: 'employer',
                      createdAt: serverTimestamp(),
                    };
                    await setDoc(doc(db, 'users', user.uid), newProfile);
                    setProfile(newProfile);
                    setView('dashboard');
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
                  }
                }}
                className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-slate-900 group-hover:text-indigo-700">Employer</span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <p className="text-sm text-slate-500">I want to post jobs and find the best candidates.</p>
              </button>
            </div>
          ) : (
            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">WhatsApp Number</label>
                <input 
                  type="tel"
                  value={studentForm.whatsappNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, whatsappNumber: e.target.value })}
                  placeholder="e.g. 919876543210"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Male', 'Female', 'Others'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setStudentForm({ ...studentForm, gender: g as any })}
                      className={cn(
                        "px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all",
                        studentForm.gender === g 
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setSelectedRole(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={async () => {
                    if (!studentForm.whatsappNumber || !studentForm.gender) return;
                    try {
                      const newProfile: UserProfile = {
                        uid: user.uid,
                        displayName: user.displayName || 'Anonymous',
                        email: user.email || '',
                        role: 'student',
                        whatsappNumber: studentForm.whatsappNumber,
                        gender: studentForm.gender as any,
                        createdAt: serverTimestamp(),
                      };
                      await setDoc(doc(db, 'users', user.uid), newProfile);
                      setProfile(newProfile);
                      setView('browse');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
                    }
                  }}
                  disabled={!studentForm.whatsappNumber || !studentForm.gender}
                  className="flex-2 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="mt-8 text-sm font-bold text-slate-400 hover:text-red-600 transition-colors"
          >
            Cancel and Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsMenuOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden"
                    >
                      <button 
                        onClick={() => { setView('browse'); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <Search className="w-4 h-4 text-slate-400" /> Browse Jobs
                      </button>
                      {user && (
                        <button 
                          onClick={() => { setView('dashboard'); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <Briefcase className="w-4 h-4 text-slate-400" /> Dashboard
                        </button>
                      )}
                      {profile?.role === 'employer' && (
                        <button 
                          onClick={() => { setView('post-job'); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-slate-400" /> Post a Job
                        </button>
                      )}
                      <div className="h-px bg-slate-100 my-1" />
                      <button 
                        onClick={() => { setView('profile'); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" /> My Profile
                      </button>
                      <button 
                        onClick={() => { setView('about'); setIsMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <Info className="w-4 h-4 text-slate-400" /> About Us
                      </button>
                      {user && (
                        <button 
                          onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('browse')}>
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">NearNest</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setView('browse')}
              className={cn("text-sm font-medium transition-colors", view === 'browse' ? "text-indigo-600" : "text-slate-600 hover:text-indigo-600")}
            >
              Browse Jobs
            </button>
            {user && (
              <button 
                onClick={() => setView('dashboard')}
                className={cn("text-sm font-medium transition-colors", view === 'dashboard' ? "text-indigo-600" : "text-slate-600 hover:text-indigo-600")}
              >
                Dashboard
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold leading-none">{profile?.displayName}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
                </div>
                <button 
                  onClick={() => setView('profile')}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <UserIcon className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'browse' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <section className="text-center space-y-4 py-12">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
                Find your next <span className="text-indigo-600">opportunity</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Connecting college students with local businesses for part-time jobs, internships, and freelance gigs.
              </p>
              
              <div className="max-w-2xl mx-auto relative mt-8 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Search by title, company, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={isNearMeFilter ? () => setIsNearMeFilter(false) : handleGetLocation}
                  className={cn(
                    "px-6 py-4 rounded-2xl border font-semibold flex items-center gap-2 transition-all",
                    isNearMeFilter 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  )}
                >
                  <MapPin className="w-5 h-5" />
                  <span className="hidden sm:inline">{isNearMeFilter ? 'Near Me Active' : 'Near Me'}</span>
                </button>
              </div>

              {/* Advanced Filters */}
              <div className="flex flex-wrap gap-4 justify-center mt-6">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Job Type</label>
                  <select 
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="All">All Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Salary Range</label>
                  <select 
                    value={salaryFilter}
                    onChange={(e) => setSalaryFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="All">Any Salary</option>
                    <option value="0-20k">Under ₹20k</option>
                    <option value="20k-50k">₹20k - ₹50k</option>
                    <option value="50k+">₹50k+</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Date Posted</label>
                  <select 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="All">Any Time</option>
                    <option value="Last 24h">Last 24 Hours</option>
                    <option value="Last 7 days">Last 7 Days</option>
                    <option value="Last 30 days">Last 30 Days</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Job Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <motion.div 
                  layoutId={job.id}
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">{job.title}</h3>
                      <p 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmployerId(job.employerId);
                          setView('employer-profile');
                        }}
                        className="text-sm text-slate-500 font-medium hover:text-indigo-600 cursor-pointer transition-colors"
                      >
                        {job.employerName}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full">
                      {job.type}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <DollarSign className="w-4 h-4" />
                      {job.salaryMin && job.salaryMax 
                        ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
                        : job.salary || 'Competitive'}
                    </div>
                    {(job.experienceMin !== undefined || job.experienceMax !== undefined) && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Briefcase className="w-4 h-4" />
                        {job.experienceMin !== undefined && job.experienceMax !== undefined
                          ? `${job.experienceMin}-${job.experienceMax} years exp.`
                          : job.experienceMin !== undefined 
                            ? `${job.experienceMin}+ years exp.`
                            : `${job.experienceMax} years exp.`}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredJobs.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold">No jobs found</h3>
                <p className="text-slate-500 mb-6">Try adjusting your search or filters</p>
                {profile?.role === 'employer' && (
                  <button 
                    onClick={seedVijayawadaJobs}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    <Plus className="w-5 h-5" />
                    Seed Vijayawada Jobs
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'employer-profile' && selectedEmployerProfile && (
          <div className="space-y-8">
            <button 
              onClick={() => setView('browse')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Browse
            </button>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Briefcase className="w-10 h-10 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">{selectedEmployerProfile.displayName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-slate-500">Employer Profile</p>
                    {averageRating && (
                      <>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-4 h-4 fill-current" />
                          {averageRating}
                          <span className="text-slate-400 font-normal text-sm">({employerReviews.length} reviews)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedEmployerProfile.companyDescription && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-2">About the Company</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {selectedEmployerProfile.companyDescription}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <h3 className="text-xl font-bold">Active Job Postings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobs.filter(j => j.employerId === selectedEmployerId).map((job) => (
                    <div 
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="p-6 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all cursor-pointer group"
                    >
                      <h4 className="font-bold group-hover:text-indigo-600 transition-colors">{job.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.type}</span>
                      </div>
                    </div>
                  ))}
                  {jobs.filter(j => j.employerId === selectedEmployerId).length === 0 && (
                    <p className="text-slate-500 italic">No active job postings at the moment.</p>
                  )}
                </div>
              </div>

              <div className="mt-12 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Company Reviews</h3>
                  {profile?.role === 'student' && !employerReviews.some(r => r.studentId === user?.uid) && (
                    <button 
                      onClick={() => setReviewRating(1)}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Leave a review
                    </button>
                  )}
                </div>

                {/* Review Form */}
                {reviewRating > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold">Share your experience</h4>
                      <button onClick={() => setReviewRating(0)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button 
                          key={star}
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none"
                        >
                          <Star className={cn("w-8 h-8 transition-all", star <= reviewRating ? "text-amber-400 fill-current scale-110" : "text-slate-300")} />
                        </button>
                      ))}
                    </div>
                    <textarea 
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="What was it like working here?"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      rows={3}
                    />
                    <button 
                      onClick={handleLeaveReview}
                      disabled={!reviewComment.trim()}
                      className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Submit Review
                    </button>
                  </motion.div>
                )}

                <div className="space-y-6">
                  {employerReviews.map((review) => (
                    <div key={review.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                            {review.studentName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{review.studentName}</p>
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={cn("w-3 h-3", i < review.rating ? "text-amber-400 fill-current" : "text-slate-200")} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">
                          {review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed pl-10">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                  {employerReviews.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-500">No reviews yet. Be the first to share your experience!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Dashboard</h2>
              {profile?.role === 'employer' && (
                <div className="flex gap-3">
                  <button 
                    onClick={seedVijayawadaJobs}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Seed Vijayawada Jobs
                  </button>
                  <button 
                    onClick={() => setView('post-job')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Post a Job
                  </button>
                </div>
              )}
            </div>

            {profile?.role === 'student' ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">My Applications</h3>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600">Job Title</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date Applied</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myApplications.map((app) => (
                        <tr key={app.id}>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">
                              {jobs.find(j => j.id === app.jobId)?.title || 'Unknown Job'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(app.createdAt?.seconds * 1000).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-full capitalize",
                              app.status === 'pending' && "bg-amber-50 text-amber-700",
                              app.status === 'accepted' && "bg-emerald-50 text-emerald-700",
                              app.status === 'rejected' && "bg-red-50 text-red-700",
                              app.status === 'reviewed' && "bg-blue-50 text-blue-700"
                            )}>
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {myApplications.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                            You haven't applied to any jobs yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Incoming Applications</h3>
                <div className="grid grid-cols-1 gap-4">
                  {employerApplications.filter(app => jobs.some(j => j.id === app.jobId && j.employerId === user?.uid)).map((app) => (
                    <div key={app.id} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-lg">{app.studentName}</h4>
                          <p className="text-sm text-slate-500">
                            Applied for <span className="font-medium text-slate-700">{jobs.find(j => j.id === app.jobId)?.title}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.status === 'pending' ? (
                            <>
                              <button 
                                onClick={() => updateApplicationStatus(app.id, 'accepted')}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Accept"
                              >
                                <CheckCircle className="w-6 h-6" />
                              </button>
                              <button 
                                onClick={() => updateApplicationStatus(app.id, 'rejected')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-6 h-6" />
                              </button>
                            </>
                          ) : (
                            <span className={cn(
                              "px-3 py-1 rounded-full text-sm font-semibold capitalize",
                              app.status === 'accepted' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            )}>
                              {app.status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <MapPin className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address</p>
                            <p className="text-sm text-slate-700">{app.address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <Phone className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile</p>
                            <p className="text-sm text-slate-700">{app.mobileNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <Mail className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</p>
                            <p className="text-sm text-slate-700">{app.email}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <BookOpen className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Study Info</p>
                            <p className="text-sm text-slate-700">{app.studyInfo}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {employerApplications.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
                      No applications received yet.
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <h3 className="text-lg font-semibold mb-4">Manage My Jobs</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {jobs.filter(j => j.employerId === user?.uid).map((job) => (
                      <div key={job.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold">{job.title}</h4>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {job.type}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-full capitalize",
                            job.status === 'open' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                          )}>
                            {job.status}
                          </span>
                          <button 
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'jobs', job.id), { 
                                  status: job.status === 'open' ? 'closed' : 'open' 
                                });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `jobs/${job.id}`);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={job.status === 'open' ? "Close Job" : "Reopen Job"}
                          >
                            {job.status === 'open' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {jobs.filter(j => j.employerId === user?.uid).length === 0 && (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
                        You haven't posted any jobs yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'post-job' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Post a New Job</h2>
              <form onSubmit={handlePostJob} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Job Title</label>
                  <input 
                    name="title" 
                    required 
                    placeholder="e.g. Social Media Intern"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Location</label>
                    <div className="flex gap-2">
                      <input 
                        name="location" 
                        required 
                        placeholder="e.g. Remote or City"
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                      <button 
                        type="button"
                        onClick={handleGetPostingLocation}
                        className={cn(
                          "p-3 rounded-xl border transition-all",
                          postingLocation ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400 border-slate-200 hover:border-indigo-300"
                        )}
                        title="Use current coordinates"
                      >
                        <MapPin className="w-5 h-5" />
                      </button>
                    </div>
                    {postingLocation && (
                      <p className="text-xs text-indigo-600 font-medium">Coordinates captured!</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Type</label>
                    <select 
                      name="type" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Internship</option>
                      <option>Freelance</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Salary Min ($)</label>
                    <input 
                      type="number"
                      name="salaryMin" 
                      placeholder="e.g. 20000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Salary Max ($)</label>
                    <input 
                      type="number"
                      name="salaryMax" 
                      placeholder="e.g. 50000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Experience Min (Years)</label>
                    <input 
                      type="number"
                      name="experienceMin" 
                      placeholder="e.g. 0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Experience Max (Years)</label>
                    <input 
                      type="number"
                      name="experienceMax" 
                      placeholder="e.g. 2"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Contact Email</label>
                    <input 
                      type="email"
                      name="contactEmail" 
                      placeholder="e.g. contact@company.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Contact Mobile</label>
                    <input 
                      type="tel"
                      name="contactPhone" 
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">WhatsApp Number (for Direct Chat)</label>
                  <input 
                    type="tel"
                    name="whatsappNumber" 
                    placeholder="e.g. 919876543210 (include country code without +)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <p className="text-xs text-slate-500">Students will see a "Chat on WhatsApp" button on your job posting.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea 
                    name="description" 
                    required 
                    rows={5}
                    placeholder="Describe the role, responsibilities, and requirements..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="flex-1 px-6 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    Post Job
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {view === 'profile' && user && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserIcon className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold">{profile?.displayName}</h2>
              <p className="text-slate-500 mb-8">{profile?.email}</p>
              
              <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Account Type</label>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-4 py-2 rounded-xl border-2 font-bold uppercase tracking-tight text-sm",
                      profile?.role === 'student' 
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                        : "border-emerald-600 bg-emerald-50 text-emerald-700"
                    )}>
                      {profile?.role}
                    </span>
                  </div>
                </div>

                {profile?.role === 'employer' && (
                  <div className="space-y-6">
                    <div className="space-y-2 text-left">
                      <label className="text-sm font-semibold text-slate-700">Company Description</label>
                      <textarea 
                        defaultValue={profile.companyDescription}
                        onBlur={async (e) => {
                          try {
                            await updateDoc(doc(db, 'users', user.uid), { companyDescription: e.target.value });
                            setProfile(p => p ? { ...p, companyDescription: e.target.value } : null);
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                          }
                        }}
                        rows={4}
                        placeholder="Tell students about your company..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-4 pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Manage My Jobs</h3>
                        <button 
                          onClick={() => setView('post-job')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Post New
                        </button>
                      </div>
                      <div className="space-y-3">
                        {jobs.filter(j => j.employerId === user.uid).map((job) => (
                          <div key={job.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-slate-900">{job.title}</p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {job.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight",
                                job.status === 'open' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                              )}>
                                {job.status}
                              </span>
                              <button 
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'jobs', job.id), { 
                                      status: job.status === 'open' ? 'closed' : 'open' 
                                    });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, `jobs/${job.id}`);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                {job.status === 'open' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ))}
                        {jobs.filter(j => j.employerId === user.uid).length === 0 && (
                          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-500 italic">No jobs posted yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {profile?.role === 'student' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">WhatsApp Number</label>
                      <input 
                        type="tel"
                        defaultValue={profile.whatsappNumber}
                        onBlur={async (e) => {
                          try {
                            await updateDoc(doc(db, 'users', user.uid), { whatsappNumber: e.target.value });
                            setProfile(p => p ? { ...p, whatsappNumber: e.target.value } : null);
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                          }
                        }}
                        placeholder="e.g. 919876543210"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Gender</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Male', 'Female', 'Others'].map((g) => (
                          <button
                            key={g}
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'users', user.uid), { gender: g });
                                setProfile(p => p ? { ...p, gender: g as any } : null);
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                              }
                            }}
                            className={cn(
                              "px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all",
                              profile.gender === g 
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                                : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {profile?.role === 'student' && (
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Applied Jobs</h3>
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100/50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Job</th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {myApplications.map((app) => {
                            const job = jobs.find(j => j.id === app.jobId);
                            return (
                              <tr key={app.id}>
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]">
                                    {job?.title || 'Unknown Job'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(app.createdAt?.seconds * 1000).toLocaleDateString()}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight",
                                    app.status === 'pending' && "bg-amber-100 text-amber-700",
                                    app.status === 'accepted' && "bg-emerald-100 text-emerald-700",
                                    app.status === 'rejected' && "bg-red-100 text-red-700",
                                    app.status === 'reviewed' && "bg-blue-100 text-blue-700"
                                  )}>
                                    {app.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {app.status === 'accepted' ? (
                                    <button 
                                      onClick={() => setSelectedJob(job || null)}
                                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                                    >
                                      <Phone className="w-3 h-3" /> Details
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Locked</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {myApplications.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                                No applications yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="pt-8 border-t border-slate-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full py-3 flex items-center justify-center gap-2 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'about' && (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
            >
              <div className="bg-indigo-600 px-8 py-12 text-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <div className="bg-white p-4 rounded-3xl shadow-2xl mx-auto mb-8 w-48 h-48 flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
                    <img 
                      src="https://picsum.photos/seed/nearnest-logo/400/400" 
                      alt="NearNest Logo" 
                      className="w-full h-full object-contain rounded-2xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h1 className="text-4xl font-black tracking-tight mb-2">About NearNest</h1>
                  <p className="text-indigo-100 font-medium text-lg">Jobs for College Students</p>
                  <p className="text-indigo-200 text-sm mt-2">Built with vision. Powered by hard work.</p>
                </div>
              </div>

              <div className="p-8 md:p-12 space-y-8">
                <section className="space-y-4">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    Our Story
                  </h2>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    NearNest is an idea built with dedication, consistency, and a clear vision for the future. This platform was created by <span className="font-bold text-slate-900">Kamireddy Vishnu Teja Reddy</span> with the goal of developing something meaningful, useful, and impactful for people.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    Our Philosophy
                  </h2>
                  <p className="text-slate-600 leading-relaxed">
                    We believe success doesn’t come from shortcuts. It comes from effort, learning, and continuous improvement. Every feature in NearNest represents hard work, patience, and a strong commitment to building something valuable from the ground up.
                  </p>
                </section>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      Our Mission
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      To create smart solutions, help people grow, and turn ideas into real opportunities.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      Our Future
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      This is just the beginning. We are working every day to improve, expand, and make NearNest stronger and more useful for everyone.
                    </p>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 text-center">
                  <p className="text-2xl font-black text-slate-900 tracking-tight mb-6">
                    Moving toward something big. 🚀🔥
                  </p>
                  <button 
                    onClick={() => setView('browse')}
                    className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Explore Opportunities
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Job Details Modal */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedJob(null);
                setIsApplying(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={selectedJob.id}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-slate-900">
                      {isApplying ? `Apply for ${selectedJob.title}` : selectedJob.title}
                    </h2>
                    {!isApplying && (
                      <p 
                        onClick={() => {
                          setSelectedEmployerId(selectedJob.employerId);
                          setView('employer-profile');
                          setSelectedJob(null);
                        }}
                        className="text-lg text-indigo-600 font-medium hover:underline cursor-pointer"
                      >
                        {selectedJob.employerName}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedJob(null);
                      setIsApplying(false);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                {!isApplying ? (
                  <>
                    <div className="flex flex-wrap gap-4 mb-8">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600">
                        <MapPin className="w-4 h-4" />
                        {selectedJob.location}
                        {userLocation && selectedJob.latitude && selectedJob.longitude && (
                          <span className="text-indigo-600 ml-1">
                            ({getDistance(userLocation.lat, userLocation.lng, selectedJob.latitude, selectedJob.longitude).toFixed(1)} mi away)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600">
                        <Clock className="w-4 h-4" />
                        {selectedJob.type}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        {selectedJob.salaryMin && selectedJob.salaryMax 
                          ? `$${selectedJob.salaryMin.toLocaleString()} - $${selectedJob.salaryMax.toLocaleString()}`
                          : selectedJob.salary || 'Competitive'}
                      </div>
                      {(selectedJob.experienceMin !== undefined || selectedJob.experienceMax !== undefined) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600">
                          <Briefcase className="w-4 h-4" />
                          {selectedJob.experienceMin !== undefined && selectedJob.experienceMax !== undefined
                            ? `${selectedJob.experienceMin}-${selectedJob.experienceMax} years exp.`
                            : selectedJob.experienceMin !== undefined 
                              ? `${selectedJob.experienceMin}+ years exp.`
                              : `${selectedJob.experienceMax} years exp.`}
                        </div>
                      )}
                    </div>

                    <div className="prose prose-slate max-w-none mb-8">
                      <h4 className="text-lg font-bold mb-2">Job Description</h4>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {selectedJob.description}
                      </p>
                    </div>

                    {(() => {
                      const isAccepted = myApplications.find(a => a.jobId === selectedJob.id)?.status === 'accepted';
                      const isMyJob = profile?.role === 'employer' && selectedJob.employerId === user?.uid;
                      const isAdmin = profile?.role === 'admin';
                      const shouldShow = (selectedJob.contactEmail || selectedJob.contactPhone || selectedJob.whatsappNumber) && (isMyJob || isAdmin || isAccepted);

                      if (!shouldShow) return null;

                      return (
                        <div className="mb-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Employer Contact Information</h4>
                            {isAccepted && (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-tight flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Application Accepted
                              </span>
                            )}
                          </div>
                          {isAccepted && (
                            <p className="text-xs text-indigo-600 mb-4 font-medium italic">
                              Congratulations! Your application has been accepted. You can now contact the employer directly using the details below.
                            </p>
                          )}
                          <div className="space-y-3">
                            {selectedJob.contactEmail && (
                              <div className="flex items-center gap-3 text-indigo-700">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                  <Mail className="w-4 h-4" />
                                </div>
                                <a href={`mailto:${selectedJob.contactEmail}`} className="text-sm font-medium hover:underline">
                                  {selectedJob.contactEmail}
                                </a>
                              </div>
                            )}
                            {selectedJob.contactPhone && (
                              <div className="flex items-center gap-3 text-indigo-700">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                  <Phone className="w-4 h-4" />
                                </div>
                                <a href={`tel:${selectedJob.contactPhone}`} className="text-sm font-medium hover:underline">
                                  {selectedJob.contactPhone}
                                </a>
                              </div>
                            )}
                            {selectedJob.whatsappNumber && (
                              <div className="flex items-center gap-3 text-emerald-600">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                  <MessageCircle className="w-4 h-4" />
                                </div>
                                <a 
                                  href={`https://wa.me/${selectedJob.whatsappNumber.replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm font-bold hover:underline flex items-center gap-1"
                                >
                                  Chat on WhatsApp
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex gap-4">
                      {user ? (
                        profile?.role === 'student' ? (
                          <>
                            {myApplications.some(a => a.jobId === selectedJob.id) ? (
                              <div className="flex-1 py-4 text-center bg-emerald-50 text-emerald-700 font-bold rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                Application Submitted
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  setIsApplying(true);
                                  setApplyForm(prev => ({ ...prev, name: profile.displayName, email: profile.email }));
                                }}
                                className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                              >
                                Apply Now
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="w-full py-4 text-center bg-slate-100 text-slate-500 font-medium rounded-2xl">
                            Employers cannot apply to jobs
                          </div>
                        )
                      ) : (
                        <button 
                          onClick={handleLogin}
                          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                        >
                          Sign in to Apply
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Full Name</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            value={applyForm.name}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Your full name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            value={applyForm.address}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, address: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Your current address"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Study Information</label>
                      <div className="relative">
                        <BookOpen className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <textarea 
                          value={applyForm.studyInfo}
                          onChange={(e) => setApplyForm(prev => ({ ...prev, studyInfo: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                          placeholder="e.g. B.Tech 3rd Year, Computer Science"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h5 className="font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        Verification Required
                      </h5>

                      {/* Mobile Verification */}
                      <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Mobile Number
                          </label>
                          {verification.isMobileVerified && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="tel"
                            disabled={verification.isMobileVerified}
                            value={applyForm.mobile}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, mobile: e.target.value }))}
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                            placeholder="+91 98765 43210"
                          />
                          {!verification.isMobileVerified && (
                            <button 
                              onClick={sendMobileOtp}
                              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
                            >
                              {verification.isMobileSent ? 'Resend' : 'Send OTP'}
                            </button>
                          )}
                        </div>
                        {verification.isMobileSent && !verification.isMobileVerified && (
                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                              type="text"
                              value={verification.mobileOtp}
                              onChange={(e) => setVerification(prev => ({ ...prev, mobileOtp: e.target.value }))}
                              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              placeholder="Enter 6-digit OTP"
                            />
                            <button 
                              onClick={verifyMobile}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all"
                            >
                              Verify
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Email Verification */}
                      <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email Address
                          </label>
                          {verification.isEmailVerified && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="email"
                            disabled={verification.isEmailVerified}
                            value={applyForm.email}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, email: e.target.value }))}
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                            placeholder="your@email.com"
                          />
                          {!verification.isEmailVerified && (
                            <button 
                              onClick={sendEmailCode}
                              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
                            >
                              {verification.isEmailSent ? 'Resend' : 'Send Code'}
                            </button>
                          )}
                        </div>
                        {verification.isEmailSent && !verification.isEmailVerified && (
                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                              type="text"
                              value={verification.emailCode}
                              onChange={(e) => setVerification(prev => ({ ...prev, emailCode: e.target.value }))}
                              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              placeholder="Enter 6-digit code"
                            />
                            <button 
                              onClick={verifyEmail}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all"
                            >
                              Verify
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setIsApplying(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => handleApply(selectedJob.id, selectedJob.employerId)}
                        disabled={!verification.isMobileVerified || !verification.isEmailVerified}
                        className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                      >
                        Submit Application
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
