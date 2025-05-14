using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AutoMapper;

public async Task<List<GetChapterDto>> GetAllChaptersAsync(int novelId)
{
    var cacheKey = $"chapters_{novelId}";
    var cachedChapters = await _cache.GetValue<List<GetChapterDto>>(cacheKey);
    if (!string.IsNullOrEmpty(_cache.GetString(cacheKey)))
    {
        return cachedChapters;
    }

    var novel = await _context.Novels.Include(n => n.Chapters)
                                     .FirstOrDefaultAsync(n => n.Id == novelId);

    if (novel == null)
        throw new Exception("Novel not found or access denied.");

    // Fix: Use GroupBy to handle potential duplicate ChapterId entries
    var readChapters = await _context.UserChapterReads
                              .Where(ur => ur.Chapter.NovelId == novelId)
                              .GroupBy(ur => ur.ChapterId)
                              .ToDictionaryAsync(g => g.Key, g => g.Any(ur => ur.IsRead));
    
    var chapterDtos = novel.Chapters
                           .OrderBy(c => c.ChapterNumber)
                           .Select(chapter =>
                           {
                               var dto = _mapper.Map<GetChapterDto>(chapter);
                               dto.IsRead = readChapters.ContainsKey(chapter.Id) && readChapters[chapter.Id];
                               return dto;
                           })
                           .ToList();

    await _cache.SetValue(cacheKey, chapterDtos);

    return chapterDtos;
} 