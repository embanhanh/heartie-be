import * as fs from 'fs';
import * as path from 'path';

const name = process.argv[2];
if (!name) {
  console.error('❌ Please provide module name');
  process.exit(1);
}

// giữ nguyên tên truyền vào (plural) cho module, controller, service
const plural = name.toLowerCase();
// đổi sang singular cho entity + dto (nếu có s cuối thì bỏ đi)
const singular = plural.endsWith('s') ? plural.slice(0, -1) : plural;

const CapPlural = plural.charAt(0).toUpperCase() + plural.slice(1);
const CapSingular = singular.charAt(0).toUpperCase() + singular.slice(1);

const baseDir = path.join(__dirname, `../src/${plural}`);

const files = [
  {
    file: `${plural}.module.ts`,
    content: `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${CapPlural}Service } from './${plural}.service';
import { ${CapPlural}Controller } from './${plural}.controller';
import { ${CapSingular} } from './${singular}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${CapSingular}])],
  controllers: [${CapPlural}Controller],
  providers: [${CapPlural}Service],
})
export class ${CapPlural}Module {}
`,
  },
  {
    file: `${plural}.service.ts`,
    content: `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${CapSingular} } from './${singular}.entity';
import { Create${CapSingular}Dto } from './dto/create-${singular}.dto';
import { Update${CapSingular}Dto } from './dto/update-${singular}.dto';

@Injectable()
export class ${CapPlural}Service {
  constructor(
    @InjectRepository(${CapSingular})
    private repo: Repository<${CapSingular}>,
  ) {}

  create(dto: Create${CapSingular}Dto) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  update(id: number, dto: Update${CapSingular}Dto) {
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
`,
  },
  {
    file: `${plural}.controller.ts`,
    content: `import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ${CapPlural}Service } from './${plural}.service';
import { Create${CapSingular}Dto } from './dto/create-${singular}.dto';
import { Update${CapSingular}Dto } from './dto/update-${singular}.dto';

@Controller('${plural}')
export class ${CapPlural}Controller {
  constructor(private readonly service: ${CapPlural}Service) {}

  @Post()
  create(@Body() dto: Create${CapSingular}Dto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: Update${CapSingular}Dto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
`,
  },
  {
    file: `${singular}.entity.ts`,
    content: `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('${plural}')
export class ${CapSingular} {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
`,
  },
  {
    file: `dto/create-${singular}.dto.ts`,
    content: `export class Create${CapSingular}Dto {
  name: string;
}
`,
  },
  {
    file: `dto/update-${singular}.dto.ts`,
    content: `export class Update${CapSingular}Dto {
  name?: string;
}
`,
  },
];

// Tạo thư mục
fs.mkdirSync(path.join(baseDir, 'dto'), { recursive: true });

// Tạo file
files.forEach(({ file, content }) => {
  const filePath = path.join(baseDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log('✅ Created:', filePath);
  } else {
    console.log('⚠️ Skipped (already exists):', filePath);
  }
});

// Auto export vào app.module.ts
const appModulePath = path.join(__dirname, '../src/app.module.ts');
let appModuleContent = fs.readFileSync(appModulePath, 'utf8');

if (!appModuleContent.includes(`${CapPlural}Module`)) {
  const importLine = `import { ${CapPlural}Module } from './${plural}/${plural}.module';\n`;
  appModuleContent = importLine + appModuleContent;

  appModuleContent = appModuleContent.replace(
    /imports:\s*\[(.*?)\]/s,
    (match, p1) => `imports: [${CapPlural}Module, ${p1}]`,
  );

  fs.writeFileSync(appModulePath, appModuleContent);
  console.log(`✅ ${CapPlural}Module exported to AppModule`);
} else {
  console.log(`⚠️ ${CapPlural}Module already in AppModule`);
}
