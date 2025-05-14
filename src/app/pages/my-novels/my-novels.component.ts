import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NovelService, UpdateNovelDto, CreateChapterDto, Chapter, NovelFilterOptions, Genre } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { SharedModule } from '../../shared/shared.module';
import { AgeVerificationService } from '../../services/age-verification.service';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-my-novels',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule, FormsModule],
  templateUrl: './my-novels.component.html',
  styleUrls: ['./my-novels.component.css']
})
export class MyNovelsComponent implements OnInit, OnDestroy {
  userNovels: Novel[] = [];
  novelChapters: Chapter[] = [];
  isLoading = false;
  isLoadingChapters = false;
  errorMessage = '';
  successMessage = '';
  editFormVisible = false;
  deleteConfirmVisible = false;
  addChapterFormVisible = false;
  manageChaptersVisible = false;
  deleteChapterConfirmVisible = false;
  selectedNovelId: number | null = null;
  selectedNovel: Novel | null = null;
  selectedChapter: Chapter | null = null;
  editForm!: FormGroup;
  chapterForm!: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  currentImageUrl: string | null = null;
  verifyingAge = false;
  previousAdultValue = false;
  private ageVerificationSubscription?: Subscription;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  isDragging = false;
  
  // Filter options
  filters: NovelFilterOptions = {};

  // Add genres property and loading indicator
  genres: Genre[] = [];
  loadingGenres = false;

  constructor(
    private novelService: NovelService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private ageVerificationService: AgeVerificationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Load genres from API
    this.loadGenres();
    
    this.loadUserNovels();
    
    // Subscribe to age verification events
    this.ageVerificationSubscription = this.ageVerificationService.showModal$.subscribe(show => {
      if (!show && this.verifyingAge) {
        // Age verification is complete, check if user is now verified
        if (this.ageVerificationService.isUserAdult()) {
          // User is verified as adult, proceed with update
          this.verifyingAge = false;
          this.submitNovelUpdate();
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
    this.editForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      status: [1, [Validators.required]],
      isAdultContent: [false]
    });

    this.chapterForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      content: ['', [Validators.required, Validators.minLength(50)]]
    });
  }

  loadUserNovels(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not found. Please log in again.';
      this.isLoading = false;
      return;
    }

    this.novelService.getUserNovels(userId, userId, this.filters).subscribe({
      next: (novels) => {
        // Set image URLs for all novels
        this.userNovels = novels.map(novel => {
          if (novel.id) {
            novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
          }
          return novel;
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user novels:', error);
        this.errorMessage = error.message || 'Failed to load your novels. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  loadNovelChapters(novelId: number): void {
    this.isLoadingChapters = true;
    this.novelChapters = [];
    
    this.novelService.getAllChapters(novelId).subscribe({
      next: (chapters) => {
        this.novelChapters = chapters;
        this.isLoadingChapters = false;
      },
      error: (error) => {
        console.error('Error loading chapters:', error);
        this.errorMessage = 'Failed to load chapters. Please try again.';
        this.isLoadingChapters = false;
      }
    });
  }

  onCreateNovel(): void {
    this.router.navigate(['/novel-create']);
  }

  showEditForm(novel: Novel): void {
    this.selectedNovel = novel;
    this.selectedNovelId = novel.id || null;
    this.previousAdultValue = novel.isAdultContent || false;
    
    this.editForm.patchValue({
      title: novel.title,
      description: novel.description || '',
      status: novel.status || NovelStatus.InProgress,
      isAdultContent: novel.isAdultContent || false
    });
    
    this.currentImageUrl = novel.imageUrl || null;
    this.imagePreview = novel.imageUrl || null;
    this.selectedFile = null;
    this.editFormVisible = true;
    this.deleteConfirmVisible = false;
    this.addChapterFormVisible = false;
    this.manageChaptersVisible = false;
    this.deleteChapterConfirmVisible = false;
  }

  showAddChapterForm(novel: Novel): void {
    this.selectedNovel = novel;
    this.selectedNovelId = novel.id || null;
    this.chapterForm.reset();
    this.addChapterFormVisible = true;
    this.editFormVisible = false;
    this.deleteConfirmVisible = false;
    this.manageChaptersVisible = false;
    this.deleteChapterConfirmVisible = false;
  }

  showManageChapters(novel: Novel): void {
    this.selectedNovel = novel;
    this.selectedNovelId = novel.id || null;
    this.manageChaptersVisible = true;
    this.editFormVisible = false;
    this.deleteConfirmVisible = false;
    this.addChapterFormVisible = false;
    this.deleteChapterConfirmVisible = false;
    
    if (novel.id) {
      this.loadNovelChapters(novel.id);
    }
  }

  showDeleteChapterConfirm(chapter: Chapter): void {
    this.selectedChapter = chapter;
    this.deleteChapterConfirmVisible = true;
    this.manageChaptersVisible = false;
  }

  cancelEdit(): void {
    this.editFormVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.imagePreview = null;
    this.selectedFile = null;
    this.currentImageUrl = null;
  }

  cancelAddChapter(): void {
    this.addChapterFormVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.chapterForm.reset();
  }

  cancelManageChapters(): void {
    this.manageChaptersVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.novelChapters = [];
  }

  cancelDeleteChapter(): void {
    this.deleteChapterConfirmVisible = false;
    this.selectedChapter = null;
    // Return to the manage chapters screen
    if (this.selectedNovel) {
      this.showManageChapters(this.selectedNovel);
    }
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
    this.fileInput.nativeElement.value = '';
  }

  updateNovel(): void {
    if (this.editForm.invalid || !this.selectedNovelId) {
      console.error('Form is invalid:', this.editForm.errors);
      // Show which fields are invalid
      Object.keys(this.editForm.controls).forEach(key => {
        const control = this.editForm.get(key);
        if (control?.invalid) {
          console.error(`Field ${key} is invalid:`, control.errors);
        }
      });
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not found. Please log in again.';
      return;
    }
    
    // If changing to adult content and user is not verified as adult
    const isChangingToAdult = !this.previousAdultValue && this.editForm.value.isAdultContent;
    if (isChangingToAdult && !this.ageVerificationService.isUserAdult()) {
      this.verifyingAge = true;
      this.ageVerificationService.showVerificationModal();
      return;
    }

    // Log all form values
    console.log('Form values before submission:', {
      title: this.editForm.value.title,
      description: this.editForm.value.description,
      status: this.editForm.value.status,
      isAdultContent: this.editForm.value.isAdultContent
    });

    this.submitNovelUpdate();
  }

  submitNovelUpdate(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.selectedNovelId) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Make sure we have all required fields and appropriate types
    const novelData: UpdateNovelDto = {
      title: this.editForm.value.title?.trim() || '',
      description: this.editForm.value.description?.trim() || '',
      status: Number(this.editForm.value.status) || 1, // Default to "In Progress" if not set
      isAdultContent: Boolean(this.editForm.value.isAdultContent)
    };
    
    // Validate required fields
    if (!novelData.title) {
      this.errorMessage = 'Title is required';
      this.isLoading = false;
      return;
    }
    
    if (!novelData.description) {
      this.errorMessage = 'Description is required';
      this.isLoading = false;
      return;
    }
    
    console.log('Updating novel with data:', JSON.stringify(novelData));

    this.novelService.updateNovel(this.selectedNovelId, userId, novelData).subscribe({
      next: (response) => {
        console.log('Update successful:', response);
        // If a cover image was selected, upload it
        if (this.selectedFile) {
          this.uploadNovelCover(this.selectedNovelId!);
        } else {
          this.handleSuccess('Novel updated successfully!');
        }
      },
      error: (error) => {
        console.error('Error updating novel:', error);
        this.errorMessage = error.message || 'Failed to update novel. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  addChapter(): void {
    if (this.chapterForm.invalid || !this.selectedNovelId) {
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not found. Please log in again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const chapterData: CreateChapterDto = {
      title: this.chapterForm.value.title,
      content: this.chapterForm.value.content,
      chapterNumber: 0 // This will be set by the backend
    };

    this.novelService.createChapter(userId, this.selectedNovelId, chapterData).subscribe({
      next: (chapter) => {
        this.handleSuccess(`Chapter "${chapter.title}" added successfully!`);
      },
      error: (error) => {
        console.error('Error adding chapter:', error);
        this.errorMessage = error.message || 'Failed to add chapter. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  deleteChapter(): void {
    if (!this.selectedNovelId || !this.selectedChapter || !this.selectedChapter.id) {
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not found. Please log in again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.novelService.deleteChapter(this.selectedNovelId, this.selectedChapter.id, userId).subscribe({
      next: () => {
        this.handleSuccess(`Chapter deleted successfully!`);
      },
      error: (error) => {
        console.error('Error deleting chapter:', error);
        this.errorMessage = error.message || 'Failed to delete chapter. Please try again later.';
        this.isLoading = false;
        // Return to the manage chapters screen
        if (this.selectedNovel) {
          this.showManageChapters(this.selectedNovel);
        }
      }
    });
  }

  uploadNovelCover(novelId: number): void {
    if (!this.selectedFile) return;
    
    this.novelService.uploadNovelImage(novelId, this.selectedFile).subscribe({
      next: () => {
        this.handleSuccess('Novel updated successfully!');
      },
      error: (error) => {
        console.error('Error uploading cover image:', error);
        // Novel was updated but cover upload failed
        this.successMessage = 'Novel updated successfully, but cover image upload failed.';
        this.isLoading = false;
        this.editFormVisible = false;
        this.selectedNovelId = null;
        this.selectedNovel = null;
        this.loadUserNovels();
      }
    });
  }

  handleSuccess(message: string): void {
    this.successMessage = message;
    this.isLoading = false;
    this.editFormVisible = false;
    this.addChapterFormVisible = false;
    this.manageChaptersVisible = false;
    this.deleteChapterConfirmVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.selectedChapter = null;
    this.selectedFile = null;
    this.imagePreview = null;
    this.loadUserNovels();
  }

  showDeleteConfirm(novelId: number | undefined): void {
    if (!novelId) return;
    
    this.selectedNovelId = novelId;
    this.deleteConfirmVisible = true;
    this.editFormVisible = false;
    this.addChapterFormVisible = false;
    this.manageChaptersVisible = false;
    this.deleteChapterConfirmVisible = false;
  }

  cancelDelete(): void {
    this.deleteConfirmVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
  }

  deleteNovel(): void {
    if (!this.selectedNovelId) {
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not found. Please log in again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.novelService.deleteNovel(this.selectedNovelId, userId).subscribe({
      next: () => {
        this.successMessage = 'Novel deleted successfully';
        this.deleteConfirmVisible = false;
        this.selectedNovelId = null;
        this.selectedNovel = null;
        this.loadUserNovels();
      },
      error: (error) => {
        console.error('Error deleting novel:', error);
        this.errorMessage = error.message || 'Failed to delete novel. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  isGenreSelected(genreId: number): boolean {
    const selectedGenres = this.editForm.get('genreIds')?.value as number[] || [];
    return selectedGenres.includes(genreId);
  }

  get novelStatusOptions(): {value: number, label: string}[] {
    return [
      { value: NovelStatus.InProgress, label: 'In Progress' },
      { value: NovelStatus.Frozen, label: 'Frozen' },
      { value: NovelStatus.Abandoned, label: 'Abandoned' },
      { value: NovelStatus.Completed, label: 'Completed' }
    ];
  }

  getStatusText(status: NovelStatus): string {
    switch (status) {
      case NovelStatus.InProgress:
        return 'In Progress';
      case NovelStatus.Frozen:
        return 'Frozen';
      case NovelStatus.Abandoned:
        return 'Abandoned';
      case NovelStatus.Completed:
        return 'Completed';
      default:
        return 'Unknown';
    }
  }

  getStatusClass(status: NovelStatus): string {
    switch (status) {
      case NovelStatus.InProgress:
        return 'status-in-progress';
      case NovelStatus.Frozen:
        return 'status-frozen';
      case NovelStatus.Abandoned:
        return 'status-abandoned';
      case NovelStatus.Completed:
        return 'status-completed';
      default:
        return 'status-unknown';
    }
  }

  onImageError(event: Event): void {
    // When the image fails to load, set default cover
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/default-cover.png';
    }
  }

  // New filtering methods
  applyFilters(): void {
    this.loadUserNovels();
  }
  
  clearFilters(): void {
    this.filters = {};
    this.loadUserNovels();
  }
  
  hasActiveFilters(): boolean {
    return this.filters.status !== undefined || this.filters.sortBy !== undefined;
  }

  loadGenres(): void {
    this.loadingGenres = true;
    this.novelService.getAllGenres().subscribe({
      next: (genres) => {
        this.genres = genres;
        this.loadingGenres = false;
      },
      error: (err) => {
        console.error('Error loading genres:', err);
        this.loadingGenres = false;
      }
    });
  }
}
