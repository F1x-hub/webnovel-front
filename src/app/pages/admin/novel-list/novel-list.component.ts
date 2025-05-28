import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Novel, NovelStatus } from '../../../components/novel-card/novel-card.component';
import { NovelService, NovelFilterOptions, Chapter, CreateChapterDto } from '../../../services/novel.service';
import { AuthService } from '../../../services/auth.service';

// Extend the Novel interface to include admin-specific properties
interface AdminNovel extends Novel {
  authorName?: string;
}

@Component({
  selector: 'app-novel-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './novel-list.component.html',
  styleUrls: ['./novel-list.component.scss']
})
export class NovelListComponent implements OnInit {
  novels: AdminNovel[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  editFormVisible = false;
  deleteConfirmVisible = false;
  selectedNovelId: number | null = null;
  selectedNovel: AdminNovel | null = null;
  editForm!: FormGroup;
  
  // Image upload properties
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  isDragging = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  // Track image loading state
  private imagesLoaded: { [key: number]: boolean } = {};
  
  // Filter options
  filters: NovelFilterOptions = {};

  // Chapter management properties
  manageChaptersVisible = false;
  novelChapters: Chapter[] = [];
  isLoadingChapters = false;
  selectedChapterId: number | null = null;
  selectedChapter: Chapter | null = null;
  editChapterVisible = false;
  deleteChapterVisible = false;
  chapterForm!: FormGroup;
  
  @ViewChild('fileInput') fileInput!: ElementRef;
  
  constructor(
    private novelService: NovelService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadNovels();
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
      chapterNumber: [0]
    });
  }

  loadNovels(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.imagesLoaded = {}; // Reset images loaded state
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not authenticated';
      this.isLoading = false;
      return;
    }

    const options: NovelFilterOptions = {
      ...this.filters,
      pageNumber: this.currentPage,
      pageSize: this.pageSize
    };

    this.novelService.getAllNovelsAdmin(options).subscribe({
      next: (response) => {
        // Set image URLs for all novels
        this.novels = response.novels.map(novel => {
          if (novel.id) {
            novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            // Initialize image loading state
            this.imagesLoaded[novel.id] = false;
          }
          return novel;
        });
        this.totalItems = response.totalItems;
        this.totalPages = response.totalPages;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading novels:', error);
        this.errorMessage = error.message || 'Failed to load novels. Please try again later.';
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

  showEditForm(novel: AdminNovel): void {
    this.selectedNovelId = novel.id || null;
    this.selectedNovel = novel;
    
    this.editForm.patchValue({
      title: novel.title,
      description: novel.description,
      status: novel.status,
      isAdultContent: novel.isAdultContent
    });
    
    // Clear any existing image preview and selected file
    this.imagePreview = null;
    this.selectedFile = null;
    
    // If the novel has an id, load its cover image
    if (novel.id) {
      const imageUrl = this.novelService.getNovelImageUrl(novel.id);
      // Only set as preview if it's not the default cover
      if (!imageUrl.includes('default-cover')) {
        this.imagePreview = imageUrl;
      }
    }
    
    this.editFormVisible = true;
    this.deleteConfirmVisible = false;
  }

  cancelEdit(): void {
    this.editFormVisible = false;
    this.selectedNovel = null;
    this.selectedNovelId = null;
    this.editForm.reset();
    this.imagePreview = null;
    this.selectedFile = null;
  }

  updateNovel(): void {
    if (this.editForm.invalid || !this.selectedNovelId) {
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not authenticated';
      return;
    }

    const formData = this.editForm.value;
    const updateData = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      isAdultContent: formData.isAdultContent
    };

    this.isLoading = true;
    this.novelService.updateNovel(this.selectedNovelId, userId, updateData).subscribe({
      next: () => {
        // If a new image was selected, upload it
        if (this.selectedFile) {
          this.uploadNovelCover(this.selectedNovelId!, this.selectedFile);
        } else {
          this.successMessage = 'Novel updated successfully';
          this.cancelEdit();
          this.loadNovels();
        }
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to update novel';
        this.isLoading = false;
      }
    });
  }

  uploadNovelCover(novelId: number, file: File): void {
    this.novelService.uploadNovelImage(novelId, file).subscribe({
      next: () => {
        this.successMessage = 'Novel updated successfully with new cover image';
        this.cancelEdit();
        this.loadNovels();
      },
      error: (error) => {
        // Novel was updated but cover upload failed
        this.successMessage = 'Novel updated successfully, but cover image upload failed';
        this.errorMessage = error.message || 'Failed to upload cover image';
        this.cancelEdit();
        this.loadNovels();
      }
    });
  }

  showDeleteConfirm(novelId: number | undefined): void {
    if (!novelId) return;
    
    this.selectedNovelId = novelId;
    this.selectedNovel = this.novels.find(n => n.id === novelId) || null;
    this.deleteConfirmVisible = true;
    this.editFormVisible = false;
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

    const userId = this.authService.currentUserValue?.id || 0;
    this.isLoading = true;

    this.novelService.deleteNovel(this.selectedNovelId, userId).subscribe({
      next: () => {
        this.successMessage = 'Novel deleted successfully';
        this.deleteConfirmVisible = false;
        this.selectedNovelId = null;
        this.loadNovels();
        setTimeout(() => {
          this.isLoading = false;
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to delete novel';
        this.deleteConfirmVisible = false;
        this.isLoading = false;
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/default-cover.png';
  }

  // Status utilities
  get novelStatusOptions(): {value: number, label: string}[] {
    return [
      { value: NovelStatus.InProgress, label: 'In Progress' },
    { value: NovelStatus.Completed, label: 'Completed' },
    { value: NovelStatus.Frozen, label: 'Frozen' },
    { value: NovelStatus.Abandoned, label: 'Abandoned' }
    ];
  }

  getStatusText(status: NovelStatus): string {
    switch (status) {
      case NovelStatus.InProgress: return 'In Progress';
      case NovelStatus.Frozen: return 'Frozen';
      case NovelStatus.Abandoned: return 'Abandoned';
      case NovelStatus.Completed: return 'Completed';
      default: return 'Unknown';
    }
  }

  getStatusClass(status: NovelStatus): string {
    switch (status) {
      case NovelStatus.InProgress: return 'status-in-progress';
      case NovelStatus.Frozen: return 'status-on-hiatus';
      case NovelStatus.Abandoned: return 'status-dropped';
      case NovelStatus.Completed: return 'status-completed';
      default: return '';
    }
  }
  
  // Pagination methods
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadNovels();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadNovels();
    }
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadNovels();
    }
  }

  // Filter methods
  applyFilters(): void {
    this.currentPage = 1;
    this.loadNovels();
  }

  clearFilters(): void {
    this.filters = {};
    this.loadNovels();
  }

  hasActiveFilters(): boolean {
    return Object.keys(this.filters).some(key => this.filters[key as keyof NovelFilterOptions] !== undefined);
  }

  setNovelStatus(status: number): void {
    this.editForm.get('status')?.setValue(status);
  }

  // Event handlers for image upload
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
    
    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.selectedFile = file;
        this.previewImage(file);
      }
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile = file;
      this.previewImage(file);
    }
  }

  previewImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.fileInput.nativeElement.value = '';
  }

  // Chapter management methods
  showManageChapters(novel: AdminNovel): void {
    this.selectedNovel = novel;
    this.selectedNovelId = novel.id || null;
    this.manageChaptersVisible = true;
    this.editFormVisible = false;
    this.deleteConfirmVisible = false;
    
    if (novel.id) {
      this.loadNovelChapters(novel.id);
    }
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

  showEditChapterForm(chapter: Chapter): void {
    this.selectedChapter = chapter;
    this.selectedChapterId = chapter.id || null;
    
    this.chapterForm.patchValue({
      title: chapter.title,
      content: chapter.content,
      chapterNumber: chapter.chapterNumber
    });
    
    this.editChapterVisible = true;
    this.manageChaptersVisible = false;
  }

  cancelEditChapter(): void {
    this.editChapterVisible = false;
    this.selectedChapter = null;
    this.selectedChapterId = null;
    
    // Return to manage chapters view
    if (this.selectedNovel) {
      this.showManageChapters(this.selectedNovel);
    }
  }

  updateChapter(): void {
    if (this.chapterForm.invalid || !this.selectedNovelId || !this.selectedChapterId) {
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.errorMessage = 'User not authenticated';
      return;
    }

    const formData = this.chapterForm.value;
    const chapterData: CreateChapterDto = {
      title: formData.title,
      content: formData.content,
      chapterNumber: formData.chapterNumber
    };

    this.isLoading = true;
    this.novelService.updateChapter(this.selectedNovelId, this.selectedChapterId, userId, chapterData).subscribe({
      next: () => {
        this.successMessage = 'Chapter updated successfully';
        this.isLoading = false;
        this.editChapterVisible = false;
        
        // Return to manage chapters view and refresh the list
        if (this.selectedNovel) {
          this.showManageChapters(this.selectedNovel);
        }
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to update chapter';
        this.isLoading = false;
      }
    });
  }

  showDeleteChapterConfirm(chapter: Chapter): void {
    this.selectedChapter = chapter;
    this.selectedChapterId = chapter.id || null;
    this.deleteChapterVisible = true;
    this.manageChaptersVisible = false;
  }

  cancelDeleteChapter(): void {
    this.deleteChapterVisible = false;
    this.selectedChapter = null;
    this.selectedChapterId = null;
    
    // Return to manage chapters view
    if (this.selectedNovel) {
      this.showManageChapters(this.selectedNovel);
    }
  }

  deleteChapter(): void {
    if (!this.selectedNovelId || !this.selectedChapterId) {
      return;
    }

    const userId = this.authService.currentUserValue?.id || 0;
    this.isLoading = true;

    this.novelService.deleteChapter(this.selectedNovelId, this.selectedChapterId, userId).subscribe({
      next: () => {
        this.successMessage = 'Chapter deleted successfully';
        this.isLoading = false;
        this.deleteChapterVisible = false;
        
        // Return to manage chapters view and refresh the list
        if (this.selectedNovel) {
          this.showManageChapters(this.selectedNovel);
        }
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to delete chapter';
        this.isLoading = false;
      }
    });
  }

  cancelManageChapters(): void {
    this.manageChaptersVisible = false;
    this.selectedNovelId = null;
    this.selectedNovel = null;
    this.novelChapters = [];
  }
}
