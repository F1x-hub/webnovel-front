import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2 } from '@angular/core';
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
  isDragging = false;
  isCreatingNovel = false;
  creationStep = 0;
  private ageVerificationSubscription?: Subscription;
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private novelService: NovelService,
    private genreService: GenreService,
    private authService: AuthService,
    private router: Router,
    private ageVerificationService: AgeVerificationService,
    private renderer: Renderer2
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
    // Make sure scrolling is re-enabled when component is destroyed
    this.renderer.setStyle(document.body, 'overflow', '');
    
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
      this.createImagePreview(this.selectedFile);
    }
  }

  createImagePreview(file: File): void {
    // Create a preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }
  
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }
  
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.selectedFile = file;
        this.createImagePreview(file);
      }
    }
  }
  
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }
  
  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
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
    this.isCreatingNovel = true;
    this.creationStep = 1;
    this.errorMessage = '';
    this.successMessage = '';
    
    // Disable scrolling when animation starts
    this.renderer.setStyle(document.body, 'overflow', 'hidden');

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
        
        // Update progress step - mark step 1 as completed and step 2 as active
        setTimeout(() => {
          this.creationStep = 2;
          
          // If a cover image was selected, upload it
          if (this.selectedFile && response.id) {
            this.uploadNovelCover(response.id);
          } else {
            // Skip to final step if no cover - show step 3 as active
            setTimeout(() => {
              this.creationStep = 3;
              // Wait to show step 3 for a moment before completing it
              setTimeout(() => this.handleSuccess(), 1500);
            }, 1000);
          }
        }, 1000); // Give a brief delay to show the step animation
      },
      error: (error) => {
        console.error('Error creating novel:', error);
        
        // Extract error message from the response
        let errorMsg = 'Failed to create novel. Please try again later.';
        
        // Check for title already exists error
        if (error.error && typeof error.error === 'string' && 
            error.error.includes('novel with this title already exists')) {
          errorMsg = error.error;
        } else if (error.error && error.error.message && 
                  error.error.message.includes('novel with this title already exists')) {
          errorMsg = error.error.message;
        } else if (typeof error.message === 'string' && 
                  error.message.includes('novel with this title already exists')) {
          errorMsg = error.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        this.errorMessage = errorMsg;
        this.isLoading = false;
        this.isCreatingNovel = false;
        this.creationStep = 0;
        
        // Re-enable scrolling on error
        this.renderer.setStyle(document.body, 'overflow', '');
        
        // Focus on the title field if it's a duplicate title error
        if (errorMsg.includes('novel with this title already exists')) {
          setTimeout(() => {
            const titleInput = document.getElementById('title');
            if (titleInput) {
              titleInput.focus();
              this.novelForm.get('title')?.setErrors({'duplicate': true});
            }
          }, 100);
        }
      }
    });
  }

  uploadNovelCover(novelId: number): void {
    if (!this.selectedFile) return;
    
    this.novelService.uploadNovelImage(novelId, this.selectedFile).subscribe({
      next: (response) => {
        console.log('Cover image uploaded successfully:', response);
        // Final step - show step 3 as active
        setTimeout(() => {
          this.creationStep = 3;
          // Wait to show step 3 for a moment before completing it
          setTimeout(() => this.handleSuccess(), 1500);
        }, 1000);
      },
      error: (error) => {
        console.error('Error uploading cover image:', error);
        // Novel was created but cover upload failed
        this.successMessage = 'Novel created successfully, but cover image upload failed.';
        this.isLoading = false;
        this.isCreatingNovel = false;
        // Re-enable scrolling on error
        this.renderer.setStyle(document.body, 'overflow', '');
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
    
    // Mark the third step as completed first
    this.creationStep = 4;
    
    // Complete the animation and wait long enough to see the checkmark
    setTimeout(() => {
      // Re-enable scrolling before navigating away
      this.renderer.setStyle(document.body, 'overflow', '');
      // Navigate to my novels page
      this.router.navigate(['/my-novels']);
    }, 2000);
  }

  isGenreSelected(genreId: number): boolean {
    const selectedGenres = this.novelForm.get('genreIds')?.value as number[] || [];
    return selectedGenres.includes(genreId);
  }
}
