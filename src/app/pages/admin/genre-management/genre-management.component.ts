import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GenreService, Genre, CreateGenreDto, UpdateGenreDto } from '../../../services/genre.service';

@Component({
  selector: 'app-genre-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './genre-management.component.html',
  styleUrls: ['./genre-management.component.css']
})
export class GenreManagementComponent implements OnInit {
  genres: Genre[] = [];
  genreForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  isEditing = false;
  selectedGenreId: number | null = null;
  showDeleteModal = false;
  genreToDelete: Genre | null = null;

  constructor(
    private genreService: GenreService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadGenres();
  }

  initForm(): void {
    this.genreForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
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
        this.errorMessage = error.message || 'Failed to load genres';
        this.isLoading = false;
      }
    });
  }

  createGenre(): void {
    if (this.genreForm.invalid) {
      return;
    }

    const genreData: CreateGenreDto = {
      name: this.genreForm.value.name
    };

    this.isLoading = true;
    this.clearMessages();

    this.genreService.createGenre(genreData).subscribe({
      next: () => {
        this.successMessage = 'Genre created successfully';
        this.resetForm();
        this.loadGenres();
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to create genre';
        this.isLoading = false;
        setTimeout(() => this.clearMessages(), 3000);
      }
    });
  }

  editGenre(genre: Genre): void {
    this.isEditing = true;
    this.selectedGenreId = genre.id;
    this.genreForm.patchValue({
      name: genre.name
    });
    
    // Scroll to form
    const formElement = document.querySelector('.form-section');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  updateGenre(): void {
    if (this.genreForm.invalid || !this.selectedGenreId) {
      return;
    }

    const genreData: UpdateGenreDto = {
      name: this.genreForm.value.name
    };

    this.isLoading = true;
    this.clearMessages();

    this.genreService.updateGenre(this.selectedGenreId, genreData).subscribe({
      next: () => {
        this.successMessage = 'Genre updated successfully';
        this.resetForm();
        this.loadGenres();
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to update genre';
        this.isLoading = false;
        setTimeout(() => this.clearMessages(), 3000);
      }
    });
  }

  openDeleteModal(genre: Genre): void {
    this.genreToDelete = genre;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.genreToDelete = null;
    this.showDeleteModal = false;
  }

  confirmDelete(): void {
    if (!this.genreToDelete) return;

    const id = this.genreToDelete.id;
    this.isLoading = true;
    this.clearMessages();
    this.closeDeleteModal();

    this.genreService.deleteGenre(id).subscribe({
      next: () => {
        this.successMessage = 'Genre deleted successfully';
        this.loadGenres();
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to delete genre';
        this.isLoading = false;
        setTimeout(() => this.clearMessages(), 3000);
      }
    });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.selectedGenreId = null;
    this.resetForm();
  }

  submitForm(): void {
    if (this.isEditing) {
      this.updateGenre();
    } else {
      this.createGenre();
    }
  }

  resetForm(): void {
    this.genreForm.reset();
    this.isEditing = false;
    this.selectedGenreId = null;
    this.isLoading = false;
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
