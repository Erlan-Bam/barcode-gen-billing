import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CalculatePriceDto {
  @IsInt()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  packageIndex?: number;

  @IsString()
  couponCode: string;

  @IsString()
  planCode: string;

  userId: string;
}
