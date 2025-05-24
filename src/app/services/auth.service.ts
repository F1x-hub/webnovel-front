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
    
    // Send the request with FormData
    return this.http.post<any>(`${this.API_URL}/Registration/register`, formData)
      .pipe(
        catchError(error => this.handleRegistrationError(error))
      );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserValue?.token;
  }

  private storeUserData(userData: any): void {
    try {
      console.log('Storing user data:', userData);
      
      let userObject: User;
      
      // Проверяем, содержит ли ответ токен и информацию о пользователе отдельно
      if (userData.token && userData.user) {
        userObject = {
          ...userData.user,
          token: userData.token
        };
      } 
      // Или же токен и данные пользователя находятся на одном уровне
      else if (userData.token) {
        // Try to extract user info from JWT token if not provided directly
        let userId = userData.id;
        let userName = userData.userName || '';
        let email = userData.email || '';
        let roles = userData.roles || [];
        
        // If we don't have a user ID, try to extract it from the token
        if (!userId && userData.token) {
          try {
            const base64Url = userData.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const tokenPayload = JSON.parse(atob(base64));
            
            // Extract user ID from token claims
            userId = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || 
                     tokenPayload['nameid'] || 
                     tokenPayload['sub'] || 
                     tokenPayload['id'] || 
                     tokenPayload['userId'];
                     
            // Convert to number if it's a string
            if (typeof userId === 'string' && !isNaN(Number(userId))) {
              userId = Number(userId);
            }
            
            // Extract email if not provided
            if (!email) {
              email = tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
                      tokenPayload['email'] || '';
            }
            
            // Extract username if not provided
            if (!userName) {
              userName = tokenPayload['userName'] ||
                        tokenPayload['username'] ||
                        tokenPayload['login'] || 
                        email.split('@')[0] || '';
            }
            
            // Extract roles if not provided
            if (!roles || roles.length === 0) {
              const tokenRoles = tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 
                                tokenPayload['role'] || [];
              roles = Array.isArray(tokenRoles) ? tokenRoles : [tokenRoles];
            }
            
            console.log('Extracted user data from token:', { userId, email, userName, roles });
          } catch (error) {
            console.error('Error parsing JWT token:', error);
          }
        }
        
        userObject = {
          id: userId,
          userName: userName,
          email: email,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          token: userData.token,
          roles: roles,
          roleId: userData.roleId,
          roleName: userData.roleName,
          isAdult: userData.isAdult,
          hasNewChapters: userData.hasNewChapters
        };
      } else {
        console.error('Invalid user data structure:', userData);
        throw new Error('Invalid user data');
      }
      
      console.log('Processed user object:', userObject);
      
      // Сохраняем пользователя в localStorage и обновляем BehaviorSubject
      localStorage.setItem('currentUser', JSON.stringify(userObject));
      this.currentUserSubject.next(userObject);
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  }

  private handleRegistrationError(error: HttpErrorResponse) {
    console.error('Registration error response:', error);
    
    let errorMsg = 'An error occurred during registration';
    
    // Handle different error formats
    if (error.error && typeof error.error === 'string') {
      errorMsg = error.error;
    } else if (error.error?.message) {
      errorMsg = error.error.message;
    } else if (error.error?.title) {
      errorMsg = error.error.title;
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    // Check for validation errors
    if (error.error && error.error.errors) {
      const validationErrors = error.error.errors;
      
      // Convert the first validation error to a readable message
      if (Object.keys(validationErrors).length > 0) {
        const firstErrorKey = Object.keys(validationErrors)[0];
        const firstError = validationErrors[firstErrorKey];
        
        if (Array.isArray(firstError) && firstError.length > 0) {
          errorMsg = firstError[0];
        }
      }
    }
    
    return throwError(() => ({
      message: errorMsg,
      originalError: error
    }));
  }

  getCurrentUserInfo(): Observable<any> {
    const userId = this.currentUserValue?.id;
    
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }
    
    return this.http.get<any>(`${this.API_URL}/User/get-user-info/${userId}`)
      .pipe(
        tap(userData => {
          // Update stored user info with fresh data
          if (userData) {
            this.updateStoredUserData(userData);
          }
        }),
        catchError(error => {
          console.error('Error getting user info:', error);
          return throwError(() => error);
        })
      );
  }

  getCurrentUserById(): Observable<any> {
    const userId = this.currentUserValue?.id;
    
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }
    
    return this.http.get<any>(`${this.API_URL}/User/get-user-by-id/${userId}`)
      .pipe(
        catchError(error => {
          console.error('Error getting user by ID:', error);
          return throwError(() => error);
        })
      );
  }

  refreshUserData(): Observable<any> {
    const userId = this.currentUserValue?.id;
    const token = this.currentUserValue?.token;
    
    if (!userId || !token) {
      return throwError(() => new Error('User not authenticated'));
    }
    
    // Get updated user information from the server
    return this.http.get<any>(`${this.API_URL}/User/get-user-info/${userId}`)
      .pipe(
        tap(userData => {
          if (userData) {
            // Preserve token from currentUserValue
            userData.token = token;
            
            // Update stored user data with new information
            this.updateStoredUserData(userData);
          }
        }),
        catchError(error => {
          console.error('Error refreshing user data:', error);
          return throwError(() => error);
        })
      );
  }

  private uploadUserImage(userId: number, imageFile: File): Observable<any> {
    if (!userId || !imageFile) {
      return throwError(() => new Error('Missing user ID or image file'));
    }
    
    const formData = new FormData();
    formData.append('file', imageFile);
    
    return this.http.post<any>(`${this.API_URL}/User/upload-profile-image/${userId}`, formData)
      .pipe(
        catchError(error => {
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