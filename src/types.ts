export type UserRole = 'student' | 'employer' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  bio?: string;
  companyDescription?: string;
  skills?: string[];
  whatsappNumber?: string;
  gender?: 'Male' | 'Female' | 'Others';
  createdAt: any;
}

export interface JobPosting {
  id: string;
  employerId: string;
  employerName: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Freelance';
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceMin?: number;
  experienceMax?: number;
  requirements?: string[];
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  status: 'open' | 'closed';
  createdAt: any;
}

export interface JobApplication {
  id: string;
  jobId: string;
  employerId: string;
  studentId: string;
  studentName: string;
  address: string;
  mobileNumber: string;
  email: string;
  studyInfo: string;
  resumeUrl?: string;
  coverLetter?: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  createdAt: any;
}

export interface CompanyReview {
  id: string;
  employerId: string;
  studentId: string;
  studentName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: any;
}
