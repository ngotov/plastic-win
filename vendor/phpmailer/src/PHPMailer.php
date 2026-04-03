<?php
namespace PHPMailer\PHPMailer;

class PHPMailer
{
    public string $Host = '';
    public int $Port = 25;
    public string $SMTPSecure = '';
    public bool $SMTPAuth = false;
    public string $Username = '';
    public string $Password = '';
    public string $CharSet = 'UTF-8';
    public string $Subject = '';
    public string $Body = '';

    private string $fromEmail = '';
    private string $fromName = '';
    /** @var string[] */
    private array $to = [];

    public function __construct(bool $exceptions = false)
    {
    }

    public function isSMTP(): void
    {
    }

    public function setFrom(string $address, string $name = ''): void
    {
        $this->fromEmail = $address;
        $this->fromName = $name;
    }

    public function addAddress(string $address): void
    {
        $this->to[] = $address;
    }

    public function send(): bool
    {
        if ($this->Host === '' || $this->fromEmail === '' || $this->to === []) {
            throw new Exception('SMTP settings are incomplete.');
        }

        $transport = strtolower($this->SMTPSecure);
        $host = in_array($transport, ['ssl', 'smtps'], true) ? 'ssl://' . $this->Host : $this->Host;

        $socket = @fsockopen($host, $this->Port, $errno, $errstr, 15);
        if (!$socket) {
            throw new Exception('SMTP connect failed: ' . $errstr);
        }

        $this->expect($socket, [220]);
        $this->command($socket, 'EHLO localhost', [250]);

        if ($this->SMTPAuth) {
            $this->command($socket, 'AUTH LOGIN', [334]);
            $this->command($socket, base64_encode($this->Username), [334]);
            $this->command($socket, base64_encode($this->Password), [235]);
        }

        $this->command($socket, 'MAIL FROM:<' . $this->fromEmail . '>', [250]);
        foreach ($this->to as $address) {
            $this->command($socket, 'RCPT TO:<' . $address . '>', [250, 251]);
        }

        $this->command($socket, 'DATA', [354]);

        $headers = [];
        $fromName = $this->fromName !== '' ? mb_encode_mimeheader($this->fromName, $this->CharSet) . ' ' : '';
        $headers[] = 'From: ' . $fromName . '<' . $this->fromEmail . '>';
        $headers[] = 'To: ' . implode(', ', $this->to);
        $headers[] = 'Subject: ' . mb_encode_mimeheader($this->Subject, $this->CharSet);
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/plain; charset=' . $this->CharSet;
        $headers[] = 'Content-Transfer-Encoding: 8bit';

        $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace(["\r\n", "\r", "\n."], ["\n", "\n", "\n.."], $this->Body);
        fwrite($socket, str_replace("\n", "\r\n", $message) . "\r\n.\r\n");
        $this->expect($socket, [250]);

        $this->command($socket, 'QUIT', [221]);
        fclose($socket);

        return true;
    }

    private function command($socket, string $command, array $okCodes): void
    {
        fwrite($socket, $command . "\r\n");
        $this->expect($socket, $okCodes);
    }

    private function expect($socket, array $okCodes): void
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $okCodes, true)) {
            throw new Exception('SMTP error: ' . trim($response));
        }
    }
}
