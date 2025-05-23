import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id?: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  token?: string;
  roles?: string[];
  roleName?: string;
  roleId?: number;
  isAdult?: boolean;
  hasNewChapters?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyCodeRequest {
  email: string;
  password: string;
  temporaryCode: string;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isAdult: boolean;
  roleId: number;
  profileImage?: File;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

export interface CurrentUser {
  id: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  refreshToken: string;
  expires: Date;
  roleId: number;
  roleName: string;
  hasNewChapters: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  login(credentials: LoginRequest): Observable<any> {
    console.log('Login credentials:', credentials);
    
    return this.http.post<any>(`${this.API_URL}/Auth/login`, credentials)
      .pipe(
        tap(response => {
          console.log('Login response:', response);
          if (response && response.token) {
            this.storeUserData(response);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Login error:', error);
          
          // Regular error handling
          let errorMsg = 'An error occurred during login';
          if (error.error && typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          return throwError(() => ({ 
            message: errorMsg,
            originalError: error
          }));
        })
      );
  }

  verifyCode(verifyData: VerifyCodeRequest): Observable<any> {
    console.log('Verifying code:', verifyData);
    
    return this.http.post(`${this.API_URL}/Auth/verify-code`, verifyData, { responseType: 'text' })
      .pipe(
        tap(response => {
          console.log('Verification response:', response);
          if (response && typeof response === 'string' && response.includes('Token:')) {
            // Extract the token from the response string
            const token = response.split('Token: ')[1]?.trim();
            if (token) {
              this.storeUserData({
                token: token,
                user: {
                  email: verifyData.email,
                  userName: verifyData.email.split('@')[0], // Placeholder until we get actual user data
                  firstName: '',
                  lastName: '',
                  roles: []
                }
              });
            }
          }
        }),
        map(response => {
          if (typeof response === 'string' && response.includes('Token:')) {
            // Extract the token from the response
            const token = response.split('Token: ')[1]?.trim();
            return {
              success: true,
              message: 'Login successful',
              token: token
            };
          }
          return {
            success: true,
            message: response
          };
        }),
        catchError((error: HttpErrorResponse) => {
          console.log('Verification error:', error);
          
          let errorMsg = 'Invalid verification code';
          if (error.error && typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          return throwError(() => ({ 
            message: errorMsg,
            originalError: error
          }));
        })
      );
  }

  register(userData: RegisterRequest): Observable<any> {
    // Log registration data before sending to help with troubleshooting
    console.log('Registration data being sent:', userData);
    
    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    
    // Add all fields to FormData with proper capitalization to match C# model binding
    formData.append('UserName', userData.userName);
    formData.append('Email', userData.email);
    formData.append('Password', userData.password);
    formData.append('FirstName', userData.firstName);
    formData.append('LastName', userData.lastName);
    formData.append('IsAdult', (userData.isAdult !== undefined ? userData.isAdult : false).toString());
    
    // Установить RoleId = 1 для обычных пользователей, если не указано другое значение
    formData.append('RoleId', (userData.roleId !== undefined ? userData.roleId : 1).toString());
    
    // Add profile image if provided
    if (userData.profileImage) {
      formData.append('ImageFiles', userData.profileImage);
    }
    
    console.log('Sending FormData to:', `${this.API_URL}/Registration/register`);
    console.log('RoleId value:', (userData.roleId !== undefined ? userData.roleId : 1).toString());
    console.log('IsAdult value:', (userData.isAdult !== undefined ? userData.isAdult : false).toString());
    
    // Send as multipart/form-data
    return this.http.post<any>(`${this.API_URL}/Registration/register`, formData)
      .pipe(
        tap(response => {
          console.log('Registration successful:', response);
          
          // If image was included, upload it using the user ID from the response
          if (userData.profileImage && response && response.id) {
            this.uploadUserImage(response.id, userData.profileImage).subscribe({
              next: imgResponse => console.log('Profile image uploaded successfully:', imgResponse),
              error: err => console.error('Error uploading profile image:', err)
            });
          }
        }),
        catchError(error => {
          console.error('Registration error detail:', error);
          
          // Check if error is from the backend with a message
          if (error.error && typeof error.error === 'string') {
            return throwError(() => ({ 
              message: error.error,
              originalError: error
            }));
          }
          
          // Check for user already exists error
          if (error.error && error.error.includes && error.error.includes('User already exists')) {
            return throwError(() => ({ 
              message: 'User with this email already exists',
              originalError: error
            }));
          }
          
          return this.handleRegistrationError(error);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserValue;
  }

  private storeUserData(userData: any): void {
    if (userData.token) {
      localStorage.setItem('token', userData.token);
      
      // Try to parse the JWT token to extract user claims
      try {
        const base64Url = userData.token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const tokenPayload = JSON.parse(atob(base64));
        
        console.log('Full token payload:', tokenPayload);
        
        // Extract user ID - this is set by ClaimTypes.NameIdentifier in the backend
        let userId = null;
        // Look for the NameIdentifier claim specifically (this is used in your backend)
        if (tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']) {
          userId = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        } else {
          userId = tokenPayload['nameid'] || tokenPayload['sub'] || tokenPayload['id'] || tokenPayload['userId'];
        }
        
        // Convert to number if it's a string
        if (typeof userId === 'string' && !isNaN(Number(userId))) {
          userId = Number(userId);
        }
        
        // Extract email - check for correct claim name
        const userEmail = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
                         tokenPayload['email'];
        
        // Extract username/name - check for correct claim names
        const userName = tokenPayload['userName'] ||
                        tokenPayload['username'] ||
                        tokenPayload['login'] || 
                        userEmail?.split('@')[0];
        
        // Extract full name - check for correct claim name
        const fullName = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 
                        tokenPayload['unique_name'] || 
                        tokenPayload['name'];
        
        // Extract first and last name if available
        const firstName = tokenPayload['firstName'] || 
                         tokenPayload['firstname'] || 
                         tokenPayload['givenname'] ||
                         (fullName && fullName.split(' ')[0]) || '';
                         
        const lastName = tokenPayload['lastName'] || 
                        tokenPayload['lastname'] || 
                        tokenPayload['surname'] ||
                        (fullName && fullName.split(' ').slice(1).join(' ')) || '';
        
        // Extract role - check for correct claim name
        const roles = tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 
                     tokenPayload['role'] || [];
        
        const roleName = Array.isArray(roles) ? roles[0] : roles;
        
        // Extract roleId (or use default based on role name)
        let roleId = tokenPayload['roleId'];
        if (typeof roleId === 'string' && !isNaN(Number(roleId))) {
          roleId = Number(roleId);
        } else if (roleName === 'Admin') {
          roleId = 1; // Assume Admin has roleId 1
        } else {
          roleId = 2; // Assume User has roleId 2
        }
        
        // Extract isAdult status
        const isAdult = !!tokenPayload['isAdult'];
        
        // Update user object with token data
        userData.user = {
          ...userData.user,
          id: userId,
          email: userEmail || userData.user?.email,
          userName: userName || userData.user?.userName,
          firstName: firstName || userData.user?.firstName,
          lastName: lastName || userData.user?.lastName,
          roles: Array.isArray(roles) ? roles : [roles],
          roleName: roleName,
          roleId: roleId,
          isAdult: isAdult || userData.user?.isAdult
        };
        
        console.log('Extracted user data from token:', userData.user);
      } catch (error) {
        console.error('Error parsing JWT token:', error);
      }
    }
    
    if (userData.user) {
      localStorage.setItem('currentUser', JSON.stringify(userData.user));
      this.currentUserSubject.next(userData.user);
    }
  }

  private handleRegistrationError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred during registration';
    
    // Check if it's a network error
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      if (error.status === 0) {
        errorMessage = 'Server is unavailable. Please check your internet connection';
      } else if (error.status === 400) {
        if (error.error && typeof error.error === 'object') {
          // Handle validation errors
          if ('errors' in error.error && error.error.errors) {
            const validationErrors = Object.values(error.error.errors as Record<string, string[]>).flat();
            if (validationErrors.length > 0) {
              const rawError = validationErrors[0].toString();
              
              // Translate common error messages
              if (rawError.includes('не должен') && rawError.includes('Age')) {
                errorMessage = 'Age must not be equal to 0';
              } else {
                errorMessage = rawError;
              }
            }
          } else if ('message' in error.error && error.error.message) {
            errorMessage = error.error.message as string;
            
            // Translate if needed
            if (errorMessage.includes('Произошла ошибка')) {
              errorMessage = 'An error occurred during registration';
            }
          } else if ('title' in error.error && error.error.title) {
            errorMessage = error.error.title as string;
          }
        }
      } else if (error.status === 409) {
        errorMessage = 'User with this email or username already exists';
      } else if (error.status === 500) {
        errorMessage = 'Internal server error. Please try again later';
      }
    }
    
    console.error('Registration error:', error);
    return throwError(() => ({ message: errorMessage, originalError: error }));
  }

  // Add new method to get current user info
  getCurrentUserInfo(): Observable<any> {
    return this.http.get(`${this.API_URL}/User/current-user`, { withCredentials: true })
      .pipe(
        tap(userData => {
          if (userData) {
            // Update stored user data
            this.storeUserData({ user: userData });
          }
        }),
        catchError(error => {
          console.error('Error getting current user info:', error);
          return throwError(() => error);
        })
      );
  }

  // Alternative method to get current user data using stored token
  getCurrentUserById(): Observable<any> {
    const user = this.currentUserValue;
    if (!user || !user.id) {
      return throwError(() => new Error('User ID not available'));
    }
    
    return this.http.get(`${this.API_URL}/User/get-user/${user.id}`)
      .pipe(
        tap(userData => {
          console.log('User data from server:', userData);
          if (userData) {
            // Update stored user data
            const updatedUser = { ...user, ...userData };
            console.log('Updated user data:', updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);
          }
        }),
        catchError(error => {
          console.error(`Error getting user data for ID ${user.id}:`, error);
          return throwError(() => error);
        })
      );
  }

  // Refresh token and user data
  refreshUserData(): Observable<any> {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }
    
    console.log('Attempting to refresh user data...');
    
    // First try to get current user info
    return this.getCurrentUserById().pipe(
      catchError(error => {
        console.log('Failed to get user by ID, trying current-user endpoint...');
        return this.getCurrentUserInfo().pipe(
          catchError(error2 => {
            console.error('All refresh attempts failed:', error2);
            // Force logout if all refresh attempts fail
            this.logout();
            return throwError(() => new Error('Failed to refresh user data. Please login again.'));
          })
        );
      })
    );
  }

  // Method to upload user image
  private uploadUserImage(userId: number, imageFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('imageFiles', imageFile);
    
    // Get authorization token but WITHOUT setting Content-Type header
    const token = localStorage.getItem('token');
    const options = token ? { 
      headers: { 
        Authorization: `Bearer ${token}`
      },
      reportProgress: true
    } : {};
    
    return this.http.post(`${this.API_URL}/Image/add-user-image/${userId}`, formData, options)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error uploading profile image:', error);
          return throwError(() => error);
        })
      );
  }

  private ensureHttps(url: string): string {
    if (url.startsWith('http:')) {
      return url.replace('http:', 'https:');
    }
    return url;
  }

  googleLogin(returnUrl: string = '/'): Observable<any> {
    // Ensure we're using HTTPS
    const appUrl = this.ensureHttps(window.location.origin);
    const callbackUrl = `${appUrl}/signin-google`; // Match backend's CallbackPath setting
    
    // Include returnUrl as state parameter for security
    const state = encodeURIComponent(JSON.stringify({ returnUrl }));
    
    // Redirect to backend to initiate Google login
    window.location.href = `${this.API_URL}/Auth/google-login?returnUrl=${encodeURIComponent(callbackUrl)}&state=${state}&prompt=select_account`;
    return new Observable();
  }

  googleRegister(): Observable<any> {
    // Ensure we're using HTTPS
    const appUrl = this.ensureHttps(window.location.origin);
    const callbackUrl = `${appUrl}/signin-google`; // Match backend's CallbackPath setting
    
    // Include registration flag in state
    const state = encodeURIComponent(JSON.stringify({ isRegistration: true }));
    
    // Redirect to backend to initiate Google registration
    window.location.href = `${this.API_URL}/Auth/google-login?returnUrl=${encodeURIComponent(callbackUrl)}&state=${state}&prompt=select_account`;
    return new Observable();
  }

  // Direct API methods using idToken
  googleDirectLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/Auth/google-authorization`, { idToken })
      .pipe(
        tap(response => {
          if (response && response.token) {
            localStorage.setItem('token', response.token);
            this.refreshUserData().subscribe();
          }
        })
      );
  }

  googleDirectRegister(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/Auth/google-registration`, { idToken });
  }
  
  // Process token from Google OAuth redirect
  processAuthToken(token: string): Observable<any> {
    // Store the token
    localStorage.setItem('token', token);
    
    // Process JWT token and extract user data
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const tokenPayload = JSON.parse(atob(base64));
      
      // Extract basic user info from token
      const userId = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
      const email = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
      const name = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
      const roles = tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || [];
      
      // Create user object
      const user: User = {
        id: userId ? Number(userId) : undefined,
        userName: name || email?.split('@')[0] || '',
        email: email || '',
        firstName: '',
        lastName: '',
        token: token,
        roles: Array.isArray(roles) ? roles : [roles]
      };
      
      // Store user in local storage and update subject
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.currentUserSubject.next(user);
      
      // Return success
      return of({ success: true });
    } catch (error) {
      console.error('Error processing auth token:', error);
      return throwError(() => ({ message: 'Invalid authentication token' }));
    }
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/User/forgot-password`, JSON.stringify(email), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          let errorMsg = 'Failed to send password reset code';
          if (error.error && typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          } else if (error.error?.errors?.email) {
            errorMsg = error.error.errors.email[0];
          } else if (error.error?.errors?.$) {
            errorMsg = error.error.errors.$[0];
          }
          
          return throwError(() => ({ 
            message: errorMsg,
            originalError: error
          }));
        })
      );
  }

  resetPassword(resetData: ResetPasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/User/reset-password`, resetData)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          let errorMsg = 'Failed to reset password';
          if (error.error && typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          return throwError(() => ({ 
            message: errorMsg,
            originalError: error
          }));
        })
      );
  }

  changePassword(changeData: ChangePasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/User/change-password`, changeData)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          let errorMsg = 'Failed to change password';
          if (error.error && typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          return throwError(() => ({ 
            message: errorMsg,
            originalError: error
          }));
        })
      );
  }

  setUserAsAdult(userId: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/User/set-user-as-adult/${userId}`, {});
  }

  updateStoredUserData(userData: User): void {
    // Get the current stored user
    const currentUser = this.currentUserValue;
    
    if (currentUser && userData) {
      // Merge the existing user data with the updated data
      const updatedUser = { ...currentUser, ...userData };
      
      // Save to localStorage and update BehaviorSubject
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      this.currentUserSubject.next(updatedUser);
    }
  }

  // Update the handleUser method to include hasNewChapters
  private handleUser(user: any): CurrentUser {
    if (!user) return null as any;
    
    // Transform the user object to match our CurrentUser interface
    const currentUser: CurrentUser = {
      id: user.id,
      userName: user.userName,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      token: user.token,
      refreshToken: user.refreshToken,
      expires: new Date(user.expires),
      roleId: user.roleId,
      roleName: user.roleName || '',
      hasNewChapters: user.hasNewChapters || false
    };
    
    // Store the user in localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update the BehaviorSubject
    this.currentUserSubject.next(currentUser);
    
    return currentUser;
  }
} 