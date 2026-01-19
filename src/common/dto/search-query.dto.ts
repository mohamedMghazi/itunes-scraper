import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Search query is required' })
  @MinLength(2, { message: 'Query must be at least 2 characters long' })
  @MaxLength(100, { message: 'Query must not exceed 100 characters' })
  @Matches(/^[\p{L}\p{N}\s\-.']+$/u, {
    message:
      'Query contains invalid characters. Only letters, numbers, spaces, hyphens, apostrophes, and periods are allowed',
  })
  @Transform(({ value }: { value: string }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  query: string;
}
