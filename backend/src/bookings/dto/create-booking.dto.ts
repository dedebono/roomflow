import { IsNotEmpty, IsString, IsUUID, IsDateString, IsOptional, IsEmail, IsEnum, Validate, MaxLength } from 'class-validator';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'isAfterStartTime', async: false })
export class IsAfterStartTimeConstraint implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments) {
    const obj = args.object as any;
    if (!obj.startTime || !endTime) return false;
    return new Date(endTime) > new Date(obj.startTime);
  }

  defaultMessage(args: ValidationArguments) {
    return 'endTime must be after startTime';
  }
}

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  @Validate(IsAfterStartTimeConstraint)
  endTime: string;
}
