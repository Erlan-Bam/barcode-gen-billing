import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString } from 'class-validator';

export enum BuyType {
  SINGLE,
  PACKAGE,
  SUBSCRIPTION,
}

export class BuyBarcodesDto {
  @IsEnum(BuyType)
  type: BuyType;

  @Type(() => String)
  @IsString()
  code: string;

  @Type(() => Number)
  @IsInt()
  credits: number;

  userId!: string;
}
