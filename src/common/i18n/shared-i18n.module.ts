import { Global, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { join } from 'path';
import { FALLBACK_LANGUAGE, LANGUAGE_QUERY_KEYS, USER_LANGUAGE_HEADER } from './language.constants';

@Global()
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: FALLBACK_LANGUAGE,
      fallbacks: {
        'en-*': 'en',
        'vi-*': FALLBACK_LANGUAGE,
      },
      loader: I18nJsonLoader,
      loaderOptions: {
        path: join(__dirname, '../../../../i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      typesOutputPath: join(
        process.cwd(),
        'src',
        'common',
        'i18n',
        'generated',
        'i18n.generated.ts',
      ),
      resolvers: [
        { use: QueryResolver, options: LANGUAGE_QUERY_KEYS },
        new HeaderResolver([USER_LANGUAGE_HEADER]),
        AcceptLanguageResolver,
      ],
    }),
  ],
  exports: [I18nModule],
})
export class SharedI18nModule {}
