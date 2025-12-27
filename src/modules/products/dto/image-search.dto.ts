import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BoundingBoxDto {
  @ApiProperty()
  @IsNumber()
  xmin: number;

  @ApiProperty()
  @IsNumber()
  ymin: number;

  @ApiProperty()
  @IsNumber()
  xmax: number;

  @ApiProperty()
  @IsNumber()
  ymax: number;
}

export class DetectedObjectDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ type: BoundingBoxDto })
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  box: BoundingBoxDto;
}

export class ObjectDetectionResponseDto {
  @ApiProperty({ type: [DetectedObjectDto] })
  objects: DetectedObjectDto[];
}

export class SearchByObjectsDto {
  @ApiProperty({ type: [BoundingBoxDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoundingBoxDto)
  boxes: BoundingBoxDto[];
}
