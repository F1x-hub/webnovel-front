import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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
  imports: [CommonModule, ReactiveFormsModule, SharedModule, FormsModule, RouterModule],
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
  editChapterFormVisible = false;
  selectedNovelId: number | null = null;
  selectedNovel: Novel | null = null;
  selectedChapter: Chapter | null = null;
  editForm!: FormGroup;
  chapterForm!: FormGroup;
  editChapterForm!: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  currentImageUrl: string | null = null;
  verifyingAge = false;
  previousAdultValue = false;
  private ageVerificationSubscription?: Subscription;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  isDragging = false;
  
  // Track image loading state
  private imagesLoaded: { [key: number]: boolean } = {};
  
  // Filter options
  filters: NovelFilterOptions = {};

  // Add genres property and loading indicator
  genres: Genre[] = [];
  loadingGenres = false;

  // Add new properties for the novel menu functionality
  activeNovelMenuId: number | null = null;
  private closeNovelMenuHandler = (): void => {
    this.closeNovelMenu();
  }

  selectedPdfFile: File | null = null;
  pdfPreview: string | null = null;
  usePdfContent: boolean = false;

  constructor(
    private novelService: NovelService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private ageVerificationService: AgeVerificationService,
    private renderer: Renderer2
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Scroll to top of page when component initializes
    window.scrollTo(0, 0);
    
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
    
    // Re-enable scrolling when the component is destroyed
    this.renderer.setStyle(document.body, 'overflow', '');
    
    // Remove any active event listeners
    document.removeEventListener('click', this.closeNovelMenuHandler);
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
      content: ['', [Validators.required, Validators.minLength(50)]],
      usePdfContent: [false]
    });
    
    this.editChapterForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      content: ['', [Validators.required, Validators.minLength(50)]],
      chapterNumber: [0],
      usePdfContent: [false]
    });
  }

  loadUserNovels(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.imagesLoaded = {}; // Reset images loaded state
    
    // Scroll to top when loading novels, especially useful after novel creation
    window.scrollTo(0, 0);
    
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
            // Initialize image loading state
            this.imagesLoaded[novel.id] = false;
          }
          return novel;
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user novels:', error);
        
        // If response is 404, treat as "no novels" instead of an error
        if (error.status === 404) {
          this.userNovels = [];
          this.isLoading = false;
          return;
        }
        
        this.errorMessage = error.message || 'Failed to load your novels. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onImageLoad(novelId: number): void {
    if (novelId) {
      this.imagesLoaded[novelId] = true;
    }
  }

  isImageLoaded(novelId: number | undefined): boolean {
    return novelId ? !!this.imagesLoaded[novelId] : false;
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
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
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
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  showManageChapters(novel: Novel): void {
    this.selectedNovel = novel;
    this.selectedNovelId = novel.id || null;
    this.manageChaptersVisible = true;
    this.editFormVisible = false;
    this.deleteConfirmVisible = false;
    this.addChapterFormVisible = false;
    this.deleteChapterConfirmVisible = false;
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
    
    if (novel.id) {
      this.loadNovelChapters(novel.id);
    }
  }

  showDeleteChapterConfirm(chapter: Chapter): void {
    this.selectedChapter = chapter;
    this.deleteChapterConfirmVisible = true;
    this.manageChaptersVisible = false;
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  cancelEdit(): void {
    this.editFormVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.imagePreview = null;
    this.selectedFile = null;
    this.currentImageUrl = null;
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
  }

  cancelAddChapter(): void {
    this.addChapterFormVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.chapterForm.reset();
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
  }

  cancelManageChapters(): void {
    this.manageChaptersVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.novelChapters = [];
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
  }

  cancelDeleteChapter(): void {
    this.deleteChapterConfirmVisible = false;
    this.selectedChapter = null;
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
    
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

    // Get the usePdfContent value
    const usePdfContent = this.chapterForm.get('usePdfContent')?.value || false;
    
    // If user selected to use PDF but didn't upload a file
    if (usePdfContent && !this.selectedPdfFile) {
      this.errorMessage = 'Please upload a PDF file or disable the PDF content option.';
      this.isLoading = false;
      return;
    }

    // Define the chapter data
    const chapterData: CreateChapterDto = {
      title: this.chapterForm.value.title,
      content: usePdfContent ? "Content will be extracted from PDF file." : this.chapterForm.value.content,
      chapterNumber: 0, // Let the backend assign the chapter number
      usePdfContent: usePdfContent,
      pdfPath: ""  // Initialize with empty string
    };

    // If using PDF, upload it first and ALWAYS wait for pdfPath before creating the chapter
    if (usePdfContent && this.selectedPdfFile) {
      this.novelService.uploadChapterPdf(userId, this.selectedNovelId!, null, this.selectedPdfFile)
        .subscribe({
          next: (response) => {
            // Set the PDF path from the response
            if (response && response.pdfPath) {
              chapterData.pdfPath = response.pdfPath;
              // Now create the chapter with the PDF information
              this.createChapterWithData(userId, this.selectedNovelId!, chapterData);
            } else {
              this.errorMessage = 'Failed to get valid PDF path from server. Please try again.';
              this.isLoading = false;
            }
          },
          error: (error) => {
            this.errorMessage = error.message || 'Failed to upload PDF. Please try again.';
            this.isLoading = false;
          }
        });
    } else {
      // Create chapter without PDF
      chapterData.usePdfContent = false; // Ensure we don't set usePdfContent without a pdfPath
      chapterData.pdfPath = "";
      this.createChapterWithData(userId, this.selectedNovelId!, chapterData);
    }
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
    this.editChapterFormVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.selectedChapter = null;
    this.selectedFile = null;
    this.imagePreview = null;
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
    
    this.loadUserNovels();
    
    // Ensure page scrolls to top to show the success message
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
  }

  showDeleteConfirm(novelId: number | undefined): void {
    if (!novelId) return;
    
    this.selectedNovelId = novelId;
    this.deleteConfirmVisible = true;
    this.editFormVisible = false;
    this.addChapterFormVisible = false;
    this.manageChaptersVisible = false;
    this.deleteChapterConfirmVisible = false;
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  cancelDelete(): void {
    this.deleteConfirmVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
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
      
      // Set image as loaded when using fallback
      const novelElement = img.closest('.novel-item');
      if (novelElement) {
        const novelId = this.findNovelIdFromElement(novelElement);
        if (novelId) {
          this.imagesLoaded[novelId] = true;
        }
      }
    }
  }

  private findNovelIdFromElement(element: Element): number | null {
    // Find the novel ID by matching the element with the corresponding novel
    const novelIndex = Array.from(element.parentElement?.children || [])
      .indexOf(element);
    
    if (novelIndex >= 0 && novelIndex < this.userNovels.length) {
      return this.userNovels[novelIndex].id || null;
    }
    
    return null;
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

  setNovelStatus(status: number): void {
    this.editForm.get('status')?.setValue(status);
    this.editForm.get('status')?.markAsTouched();
  }

  showEditChapterForm(chapter: Chapter): void {
    this.selectedChapter = chapter;
    
    this.editChapterForm.patchValue({
      title: chapter.title,
      content: chapter.content,
      chapterNumber: chapter.chapterNumber,
      usePdfContent: chapter.usePdfContent || false
    });
    
    this.editChapterFormVisible = true;
    this.manageChaptersVisible = false;
    
    // Reset PDF selection
    this.selectedPdfFile = null;
    this.pdfPreview = null;
    
    // Disable scrolling when modal opens
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }
  
  cancelEditChapter(): void {
    this.editChapterFormVisible = false;
    
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
    
    // Return to the manage chapters screen
    if (this.selectedNovel) {
      this.showManageChapters(this.selectedNovel);
    }
  }
  
  updateChapter(): void {
    if (this.editChapterForm.invalid || !this.selectedNovelId || !this.selectedChapter || !this.selectedChapter.id) {
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

    // Get the usePdfContent value
    const usePdfContent = this.editChapterForm.get('usePdfContent')?.value || false;
    
    // If user selected to use PDF but didn't upload a file and there's no existing PDF
    if (usePdfContent && !this.selectedPdfFile && !this.selectedChapter.pdfPath) {
      this.errorMessage = 'Please upload a PDF file or disable the PDF content option.';
      this.isLoading = false;
      return;
    }

    const chapterData: CreateChapterDto = {
      title: this.editChapterForm.value.title,
      content: usePdfContent ? "Content will be extracted from PDF file." : this.editChapterForm.value.content,
      chapterNumber: this.editChapterForm.value.chapterNumber,
      usePdfContent: usePdfContent,
      pdfPath: usePdfContent ? this.selectedChapter.pdfPath || "" : ""
    };

    // If using PDF and a new file is selected, upload it first
    if (usePdfContent && this.selectedPdfFile) {
      this.novelService.uploadChapterPdf(userId, this.selectedNovelId, this.selectedChapter.id, this.selectedPdfFile)
        .subscribe({
          next: (response) => {
            // Set the PDF path from the response
            if (response && response.pdfPath) {
              chapterData.pdfPath = response.pdfPath;
              
              // Now update the chapter with the PDF information
              this.updateChapterWithData(userId, this.selectedNovelId!, this.selectedChapter!.id!, chapterData);
            } else {
              this.errorMessage = 'Failed to get valid PDF path from server. Please try again.';
              this.isLoading = false;
            }
          },
          error: (error) => {
            this.errorMessage = error.message || 'Failed to upload PDF. Please try again.';
            this.isLoading = false;
          }
        });
    } else if (usePdfContent && this.selectedChapter.pdfPath) {
      // Using existing PDF, proceed with update
      this.updateChapterWithData(userId, this.selectedNovelId, this.selectedChapter.id, chapterData);
    } else {
      // Update chapter without PDF
      chapterData.usePdfContent = false;
      chapterData.pdfPath = ""; // Set an empty string instead of undefined
      this.updateChapterWithData(userId, this.selectedNovelId, this.selectedChapter.id, chapterData);
    }
  }

  // Helper method to update a chapter after potential PDF upload
  private updateChapterWithData(userId: number, novelId: number, chapterId: number, chapterData: CreateChapterDto): void {
    // Safety check - if usePdfContent is true, pdfPath must not be empty
    if (chapterData.usePdfContent && (!chapterData.pdfPath || chapterData.pdfPath.trim() === '')) {
      this.errorMessage = 'Failed to update chapter: PDF path is missing. Please try again with a PDF file.';
      this.isLoading = false;
      return;
    }

    // When not using PDF content, ensure pdfPath is an empty string, not undefined
    if (!chapterData.usePdfContent) {
      chapterData.pdfPath = "";
    }

    this.novelService.updateChapter(novelId, chapterId, userId, chapterData).subscribe({
      next: () => {
        this.handleSuccess(`Chapter "${chapterData.title}" updated successfully!`);
        this.selectedPdfFile = null;
        this.pdfPreview = null;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to update chapter. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  // Add new methods for the novel menu functionality
  toggleNovelMenu(event: Event, novel: Novel): void {
    event.stopPropagation();
    
    if (this.activeNovelMenuId === novel.id) {
      this.closeNovelMenu();
    } else {
      this.activeNovelMenuId = novel.id || null;
      
      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeNovelMenuHandler);
      });
    }
  }
  
  closeNovelMenu(): void {
    this.activeNovelMenuId = null;
    document.removeEventListener('click', this.closeNovelMenuHandler);
  }

  // Add new methods for PDF handling
  onPdfFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files[0]) {
      this.selectedPdfFile = input.files[0];
      this.createPdfPreview(this.selectedPdfFile);
    }
  }

  createPdfPreview(file: File): void {
    this.pdfPreview = file.name;
  }

  removePdf(): void {
    this.selectedPdfFile = null;
    this.pdfPreview = null;
    // Reset file input
    const pdfInput = document.getElementById('pdfFile') as HTMLInputElement;
    if (pdfInput) pdfInput.value = '';
  }

  triggerPdfInput(): void {
    const pdfInput = document.getElementById('pdfFile') as HTMLInputElement;
    if (pdfInput) pdfInput.click();
  }

  toggleUsePdfContent(): void {
    this.usePdfContent = !this.usePdfContent;
    
    const contentControl = this.chapterForm.get('content');
    if (this.usePdfContent) {
      // When enabling PDF mode
      if (contentControl) {
        // Set a default content value for PDF chapters
        contentControl.setValue('Content will be extracted from PDF file.');
        // Remove validation requirements for PDF mode
        contentControl.setValidators(null);
        contentControl.updateValueAndValidity();
      }
    } else {
      // When disabling PDF mode, restore original validators
      if (contentControl) {
        contentControl.setValidators([Validators.required, Validators.minLength(50)]);
        contentControl.updateValueAndValidity();
      }
    }
    
    this.chapterForm.get('usePdfContent')?.setValue(this.usePdfContent);
  }

  toggleEditUsePdfContent(): void {
    const currentValue = this.editChapterForm.get('usePdfContent')?.value;
    this.editChapterForm.get('usePdfContent')?.setValue(!currentValue);
    
    const contentControl = this.editChapterForm.get('content');
    if (!currentValue) {
      // Switching to PDF mode
      if (contentControl) {
        // Set a default content value for PDF chapters
        contentControl.setValue('Content will be extracted from PDF file.');
        // Remove validation requirements for PDF mode
        contentControl.setValidators(null);
        contentControl.updateValueAndValidity();
      }
    } else {
      // Switching to text mode, restore original validators
      if (contentControl) {
        contentControl.setValidators([Validators.required, Validators.minLength(50)]);
        contentControl.updateValueAndValidity();
      }
    }
  }

  // Helper method to create a chapter after potential PDF upload
  private createChapterWithData(userId: number, novelId: number, chapterData: CreateChapterDto): void {
    // Safety check - if usePdfContent is true, pdfPath must not be empty
    if (chapterData.usePdfContent && (!chapterData.pdfPath || chapterData.pdfPath.trim() === '')) {
      this.errorMessage = 'Failed to add chapter: PDF path is missing. Please try again with a PDF file.';
      this.isLoading = false;
      return;
    }
    
    // When not using PDF content, ensure pdfPath is an empty string
    if (!chapterData.usePdfContent) {
      chapterData.pdfPath = "";
    }
    
    this.novelService.createChapter(userId, novelId, chapterData).subscribe({
      next: (chapter) => {
        this.handleSuccess(`Chapter "${chapter.title}" added successfully!`);
        this.selectedPdfFile = null;
        this.pdfPreview = null;
        this.usePdfContent = false;
      },
      error: (error) => {
        // Try to extract more detailed error information
        let errorDetails = '';
        if (error.error && error.error.errors) {
          const validationErrors = error.error.errors;
          Object.keys(validationErrors).forEach(key => {
            errorDetails += `${key}: ${validationErrors[key].join(', ')}\n`;
          });
        }
        
        if (errorDetails) {
          this.errorMessage = `Failed to add chapter. Validation errors:\n${errorDetails}`;
        } else {
          this.errorMessage = error.message || error.error?.title || 'Failed to add chapter. Please try again later.';
        }
        
        this.isLoading = false;
      }
    });
  }
}
