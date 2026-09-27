import { execSync } from 'child_process';

function run(command, description) {
  console.log(`\n⏳ ${description}...`);
  try {
    const output = execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error(`❌ Error en: ${command}`);
    return false;
  }
}

async function main() {
  const customMessage = process.argv.slice(2).join(' ').trim();
  const timestamp = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const commitMessage = customMessage || `deploy: actualización automática (${timestamp})`;

  console.log('========================================================');
  console.log('🚀 POINTLY - DESPLIEGUE AUTOMÁTICO A GITHUB Y VERCEL');
  console.log('========================================================');

  // 1. Validar compilación local antes de subir
  console.log('\n🔍 1. Validando compilación del proyecto con Next.js...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Compilación exitosa (0 errores).');
  } catch (e) {
    console.error('❌ La compilación falló. Corrige los errores antes de desplegar a Vercel.');
    process.exit(1);
  }

  // 2. Añadir todos los cambios a Git
  run('git add .', '2. Agregando archivos modificados a Git');

  // 3. Crear commit
  console.log(`\n📦 3. Creando commit con mensaje: "${commitMessage}"`);
  try {
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  } catch {
    console.log('ℹ️ No hay cambios pendientes por commitear (el árbol ya está limpio).');
  }

  // 4. Subir a GitHub
  console.log('\n⬆️ 4. Subiendo cambios a GitHub (origin/main)...');
  try {
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('\n========================================================');
    console.log('🎉 ¡DESPLIEGUE ENVIADO CON ÉXITO!');
    console.log('📡 Vercel detectó el push y está construyendo tu versión');
    console.log('   en producción automáticamente.');
    console.log('========================================================\n');
  } catch (e) {
    console.error('❌ Error al subir a GitHub. Verifica tus credenciales o conexión.');
    process.exit(1);
  }
}

main();
