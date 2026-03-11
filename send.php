<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/mail-config.php';
require_once __DIR__ . '/vendor/phpmailer/src/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

const RATE_LIMIT_SECONDS = 20;
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

function respond(int $statusCode, bool $success, string $message): void
{
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function getClientIp(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown';
}

function isValidPhone(string $phone): bool
{
    if (!preg_match('/^[0-9+()\-\s]{6,30}$/u', $phone)) {
        return false;
    }

    $digitsOnly = preg_replace('/\D+/', '', $phone) ?? '';
    $digitsCount = strlen($digitsOnly);

    return $digitsCount >= PHONE_MIN_DIGITS && $digitsCount <= PHONE_MAX_DIGITS;
}

function rateLimit(string $ip): bool
{
    $rateDir = sys_get_temp_dir() . '/melke_rate';
    if (!is_dir($rateDir)) {
        @mkdir($rateDir, 0775, true);
    }

    $rateFile = $rateDir . '/ip_' . md5($ip);
    $lastRequest = is_file($rateFile) ? (int) file_get_contents($rateFile) : 0;

    if ($lastRequest > 0 && (time() - $lastRequest) < RATE_LIMIT_SECONDS) {
        return false;
    }

    file_put_contents($rateFile, (string) time(), LOCK_EX);
    return true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Метод не поддерживается.');
}

$ip = getClientIp();
if (!rateLimit($ip)) {
    respond(429, false, 'Слишком частые отправки. Попробуйте чуть позже.');
}

$honeypot = trim((string) ($_POST['website'] ?? ''));
if ($honeypot !== '') {
    respond(400, false, 'Ошибка отправки заявки.');
}

$name = trim((string) ($_POST['name'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));

if ($phone === '') {
    respond(422, false, 'Укажите номер телефона.');
}

if (!isValidPhone($phone)) {
    respond(422, false, 'Проверьте корректность номера телефона.');
}

$page = trim((string) ($_POST['page'] ?? ''));
if ($page === '') {
    $page = trim((string) ($_SERVER['HTTP_REFERER'] ?? 'Не определено'));
}
if ($page === '') {
    $page = 'Не определено';
}

$dateTime = date('d.m.Y H:i:s');
$userAgent = trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'Не определен'));

$body = "Новая заявка с сайта " . SMTP_SITE_DOMAIN . "\n"
    . "Имя: " . ($name !== '' ? $name : 'Не указано') . "\n"
    . "Телефон: {$phone}\n"
    . "Страница: {$page}\n"
    . "Дата и время: {$dateTime}\n"
    . "IP: {$ip}\n"
    . "User-Agent: {$userAgent}\n";

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = SMTP_HOST;
    $mail->Port = SMTP_PORT;
    $mail->SMTPSecure = SMTP_ENCRYPTION;
    $mail->SMTPAuth = SMTP_AUTH;
    $mail->Username = SMTP_USERNAME;
    $mail->Password = SMTP_PASSWORD;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
    $mail->addAddress(SMTP_TO_EMAIL);

    $mail->Subject = 'Новая заявка с сайта ' . SMTP_SITE_DOMAIN;
    $mail->Body = $body;

    $mail->send();
    respond(200, true, 'Спасибо! Заявка отправлена.');
} catch (Exception $exception) {
    respond(500, false, 'Не удалось отправить заявку. Попробуйте позже.');
}
