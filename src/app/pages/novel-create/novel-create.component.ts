import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NovelService, CreateNovelDto } from '../../services/novel.service';
import { GenreService, Genre } from '../../services/genre.service';
import { AuthService } from '../../services/auth.service';
import { NovelStatus } from '../../components/novel-card/novel-card.component';
import { AgeVerificationService } from '../../services/age-verification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-novel-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './novel-create.component.html',
  styleUrls: ['./novel-create.component.css']
})
export class NovelCreateComponent implements OnInit, OnDestroy {
  novelForm!: FormGroup;
  genres: Genre[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  verifyingAge = false;
  private ageVerificationSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private novelService: NovelService,
    private genreService: GenreService,
    private authService: AuthService,
    private router: Router,
    private ageVerificationService: AgeVerificationService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.initForm();
    this.loadGenres();
    
    // Subscribe to age verification events
    this.ageVerificationSubscription = this.ageVerificationService.showModal$.subscribe(show => {
      if (!show && this.verifyingAge) {
        // Age verification is complete, check if user is now verified
        if (this.ageVerificationService.isUserAdult()) {
          // User is verified as adult, proceed with submission
          this.verifyingAge = false;
          this.submitNovel();
        } else {
          // User declined verification or verification failed
          this.verifyingAge = false;
          this.errorMessage = 'Age verification is required to create adult content.';
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.ageVerificationSubscription) {
      this.ageVerificationSubscription.unsubscribe();
    }
  }

  initForm(): void {
    this.novelForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      genreIds: [[], [Validators.required]],
      isAdultContent: [false]
    });
  }

  loadGenres(): void {
    this.isLoading = true;
    this.genreService.getAllGenres().subscribe({
      next: (genres) => {
        this.genres = genres;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading genres:', error);
        this.errorMessage = 'Failed to load genres. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onGenreChange(genreId: number, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const genreIds = this.novelForm.get('genreIds')?.value as number[] || [];
    
    if (isChecked && !genreIds.includes(genreId)) {
      genreIds.push(genreId);
    } else if (!isChecked && genreIds.includes(genreId)) {
      const index = genreIds.indexOf(genreId);
      if (index !== -1) {
        genreIds.splice(index, 1);
      }
    }
    
    this.novelForm.get('genreIds')?.setValue(genreIds);
    this.novelForm.get('genreIds')?.markAsTouched();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onSubmit(): void {
    if (this.novelForm.invalid) {
      Object.keys(this.novelForm.controls).forEach(key => {
        this.novelForm.get(key)?.markAsTouched();
      });
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'You need to be logged in to create a novel';
      return;
    }

    // Check if this is adult content and user needs verification
    if (this.novelForm.value.isAdultContent && !this.ageVerificationService.isUserAdult()) {
      this.verifyingAge = true;
      this.ageVerificationService.showVerificationModal();
      
      // We'll wait for the user to go through verification
      return;
    }

    this.submitNovel();
  }

  submitNovel(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const novelData: CreateNovelDto = {
      title: this.novelForm.value.title,
      description: this.novelForm.value.description,
      genreIds: this.novelForm.value.genreIds,
      status: NovelStatus.InProgress,
      isAdultContent: this.novelForm.value.isAdultContent
    };

    this.novelService.createNovel(novelData, userId).subscribe({
      next: (response) => {
        console.log('Novel created successfully:', response);
        
        // If a cover image was selected, upload it
        if (this.selectedFile && response.id) {
          this.uploadNovelCover(response.id);
        } else {
          this.handleSuccess();
        }
      },
      error: (error) => {
        console.error('Error creating novel:', error);
        this.errorMessage = error.message || 'Failed to create novel. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  uploadNovelCover(novelId: number): void {
    if (!this.selectedFile) return;
    
    this.novelService.uploadNovelImage(novelId, this.selectedFile).subscribe({
      next: (response) => {
        console.log('Cover image uploaded successfully:', response);
        this.handleSuccess();
      },
      error: (error) => {
        console.error('Error uploading cover image:', error);
        // Novel was created but cover upload failed
        this.successMessage = 'Novel created successfully, but cover image upload failed.';
        this.isLoading = false;
        setTimeout(() => {
          this.router.navigate(['/my-novels']);
        }, 1500);
      }
    });
  }

  handleSuccess(): void {
    this.successMessage = 'Novel created successfully!';
    this.novelForm.reset();
    this.selectedFile = null;
    this.imagePreview = null;
    this.isLoading = false;
    
    // Navigate to my novels page after a short delay
    setTimeout(() => {
      this.router.navigate(['/my-novels']);
    }, 1500);
  }

  isGenreSelected(genreId: number): boolean {
    const selectedGenres = this.novelForm.get('genreIds')?.value as number[] || [];
    return selectedGenres.includes(genreId);
  }
}
