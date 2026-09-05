import { IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

export class CreateWebhookConfigDto {
  @IsNotEmpty()
  @MaxLength(500)
  @IsUrl(
    {
      require_tld: false,
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    {
      message: 'endpointUrl must be a valid HTTP or HTTPS URL',
    },
  )
  endpointUrl!: string;
}
