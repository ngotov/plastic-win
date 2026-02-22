<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

const RECIPIENT_EMAIL = 'alexander.v.cherne@yandex.ru';
const MAIL_SUBJECT = 'Заявка с сайта melke.zonakomforta-spb.ru';
const RATE_LIMIT_SECONDS = 20;
const LOG_FILE = __DIR__ . '/send.log';

function respond(int $statusCode, bool $success, string $message): void
{
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function writeLog(string $message): void
{
    $line = sprintf("[%s] %s\n", date('Y-m-d H:i:s'), $message);
    error_log($line, 3, LOG_FILE);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Метод не поддерживается.');
}

$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/melke_rate_' . md5($ip);
$lastRequest = is_file($rateFile) ? (int) file_get_contents($rateFile) : 0;

if ($lastRequest > 0 && (time() - $lastRequest) < RATE_LIMIT_SECONDS) {
    respond(429, false, 'Слишком частые отправки. Попробуйте позже.');
}

$name = trim((string) ($_POST['name'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$honeypot = trim((string) ($_POST['website'] ?? ''));

if ($honeypot !== '') {
    writeLog('Spam trap triggered from IP: ' . $ip);
    respond(400, false, 'Ошибка отправки.');
}

if ($phone === '') {
    respond(422, false, 'Укажите номер телефона.');
}

if (!preg_match('/^[0-9+()\-\s]{6,30}$/u', $phone)) {
    respond(422, false, 'Некорректный формат номера телефона.');
}

$body = "Новая заявка с сайта melke.zonakomforta-spb.ru\n"
    . "Имя: " . ($name !== '' ? $name : 'Не указано') . "\n"
    . "Телефон: {$phone}\n"
    . "IP: {$ip}\n"
    . "Дата: " . date('d.m.Y H:i:s') . "\n";

$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/plain; charset=UTF-8',
    'From: melke.zonakomforta-spb.ru <no-reply@melke.zonakomforta-spb.ru>',
    'Reply-To: no-reply@melke.zonakomforta-spb.ru',
    'X-Mailer: PHP/' . phpversion(),
];

$sent = @mail(RECIPIENT_EMAIL, MAIL_SUBJECT, $body, implode("\r\n", $headers));

if (!$sent) {
    writeLog('Mail send failed from IP: ' . $ip . '; phone: ' . $phone);
    respond(500, false, 'Не удалось отправить сообщение. Попробуйте позже.');
}

file_put_contents($rateFile, (string) time(), LOCK_EX);
respond(200, true, 'Отправлено');
