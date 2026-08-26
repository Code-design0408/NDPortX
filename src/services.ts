export const COMMON_PORTS: Record<number, string> = {
  20: "FTP-DATA",
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  67: "DHCP",
  68: "DHCP",
  69: "TFTP",
  80: "HTTP",
  110: "POP3",
  111: "RPC",
  123: "NTP",
  135: "RPC",
  137: "NetBIOS",
  138: "NetBIOS",
  139: "NetBIOS",
  143: "IMAP",
  161: "SNMP",
  389: "LDAP",
  443: "HTTPS",
  445: "SMB",
  465: "SMTPS",
  514: "Syslog",
  587: "SMTP",
  631: "IPP",
  993: "IMAPS",
  995: "POP3S",
  1433: "MSSQL",
  1521: "Oracle",
  2049: "NFS",
  2375: "Docker",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5900: "VNC",
  6379: "Redis",
  8080: "HTTP-Proxy",
  8443: "HTTPS-Alt",
  9000: "SonarQube",
  9200: "Elasticsearch",
  27017: "MongoDB",
};

export function getService(port: number): string {
  return COMMON_PORTS[port] || "Unknown";
}

// Quick presets for the "Port Range" section
export const TOP_100_PORTS: number[] = Array.from(
  new Set([
    1, 3, 4, 6, 7, 9, 13, 17, 19, 20, 21, 22, 23, 24, 25, 26, 30, 32, 33,
    37, 42, 43, 49, 53, 70, 79, 80, 81, 82, 83, 84, 88, 89, 90, 99, 100,
    106, 109, 110, 111, 113, 119, 125, 135, 139, 143, 144, 146, 161, 163,
    179, 199, 211, 212, 222, 254, 255, 256, 259, 264, 280, 301, 306, 311,
    340, 366, 389, 406, 407, 416, 417, 425, 427, 443, 444, 445, 458, 464,
    465, 481, 497, 500, 512, 513, 514, 515, 524, 541, 543, 544, 545, 548,
    554, 555, 563, 587, 593, 616, 617, 625, 631, 636, 646, 648, 666, 667,
  ])
).sort((a, b) => a - b).slice(0, 100);

const base1024 = Array.from({ length: 1024 }, (_, i) => i + 1);
const highPorts = [
  1080, 1194, 1433, 1521, 1723, 2049, 2082, 2083, 2086, 2087, 2095,
  2096, 2222, 2375, 2376, 3000, 3128, 3306, 3389, 3690, 4444, 4567,
  4899, 5000, 5432, 5555, 5601, 5672, 5900, 5984, 6000, 6379, 6660,
  6666, 6667, 6881, 7000, 7001, 7077, 7777, 8000, 8008, 8080, 8081,
  8088, 8089, 8090, 8091, 8443, 8500, 8888, 9000, 9042, 9090, 9200,
  9300, 9418, 9999, 10000, 11211, 27017, 27018, 28017, 32400, 50000,
];

export const TOP_1000_PORTS: number[] = Array.from(
  new Set([...base1024, ...highPorts])
).sort((a, b) => a - b);

export const COMMON_WEB_PORTS: number[] = Array.from(
  new Set([80, 81, 443, 3000, 3128, 5000, 8000, 8008, 8080, 8081, 8088, 8090, 8443, 8888, 9000, 9090])
).sort((a, b) => a - b);

export const PRESETS: Record<string, number[]> = {
  "Top 100": TOP_100_PORTS,
  "Top 1000": TOP_1000_PORTS,
  "Common Web": COMMON_WEB_PORTS,
};
