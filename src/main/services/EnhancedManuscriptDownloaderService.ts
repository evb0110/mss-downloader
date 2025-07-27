import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { PDFDocument, rgb } from 'pdf-lib';
import { ManifestCache } from './ManifestCache';
import { configService } from './ConfigService';
import { LibraryOptimizationService } from './LibraryOptimizationService';
import { createProgressMonitor } from './IntelligentProgressMonitor';
import { ZifImageProcessor } from './ZifImageProcessor';
import { TileEngineService } from './tile-engine/TileEngineService';
import { SharedManifestAdapter } from './SharedManifestAdapter';
import { DownloadLogger } from './DownloadLogger';
import type { ManuscriptManifest, LibraryInfo } from '../../shared/types';
import type { TLibrary } from '../../shared/queueTypes';
import * as https from 'https';
import { JSDOM } from 'jsdom';

const MIN_VALID_IMAGE_SIZE_BYTES = 1024; // 1KB heuristic

export class EnhancedManuscriptDownloaderService {
    private manifestCache: ManifestCache;
    private zifProcessor: ZifImageProcessor;
    private tileEngineService: TileEngineService;
    private sharedManifestAdapter: SharedManifestAdapter;
    private logger: DownloadLogger;

    constructor(manifestCache?: ManifestCache) {
        this.manifestCache = manifestCache || new ManifestCache();
        this.zifProcessor = new ZifImageProcessor();
        this.tileEngineService = new TileEngineService();
        this.sharedManifestAdapter = new SharedManifestAdapter(this.fetchWithHTTPS.bind(this));
        this.logger = DownloadLogger.getInstance();
        // Clear potentially problematic cached manifests on startup
        this.manifestCache.clearProblematicUrls().catch(error => {
            console.warn('Failed to clear problematic cache entries:', (error as Error).message);
        });
    }

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'BDL (Biblioteca Digitale Lombarda)',
            example: 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903',
            description: 'Biblioteca Digitale Lombarda digital manuscripts via IIIF',
        },
        {
            name: 'Berlin State Library',
            example: 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001',
            description: 'Staatsbibliothek zu Berlin digital manuscript collections via IIIF',
        },
        {
            name: 'BNE (Biblioteca Nacional de España)',
            example: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
            description: 'Spanish National Library digital manuscript and historical document collection',
        },
        {
            name: 'British Library',
            example: 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001',
            description: 'British Library digital manuscript collections via IIIF',
        },
        {
            name: 'Cambridge University Digital Library',
            example: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1',
            description: 'Cambridge University Library digital manuscripts via IIIF',
        },
        {
            name: 'Cecilia (Grand Albigeois)',
            example: 'https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=',
            description: 'Grand Albigeois mediatheques digital collections',
        },
        {
            name: 'Cologne Dom Library',
            example: 'https://digital.dombibliothek-koeln.de/hs/content/zoom/156145',
            description: 'Cologne Cathedral Library digital manuscript collection',
        },
        {
            name: 'Czech Digital Library (VKOL)',
            example: 'https://dig.vkol.cz/dig/mii87/0001rx.htm',
            description: 'Czech digital manuscript library (Experimental)',
        },
        {
            name: 'Dijon Patrimoine',
            example: 'http://patrimoine.bm-dijon.fr/pleade/img-viewer/MS00114/?ns=FR212316101_CITEAUX_MS00114_000_01_PS.jpg',
            description: 'Bibliothèque municipale de Dijon digital manuscripts',
        },
        {
            name: 'Dublin ISOS (DIAS)',
            example: 'https://www.isos.dias.ie/RIA/RIA_MS_D_ii_3.html',
            description: 'Irish Script On Screen (Dublin Institute for Advanced Studies)',
        },
        {
            name: 'Dublin MIRA',
            example: 'https://www.mira.ie/105',
            description: 'Manuscript, Inscription and Realia Archive (Dublin)',
        },
        {
            name: 'Durham University',
            example: 'https://iiif.durham.ac.uk/index.html?manifest=t1mp2676v52p',
            description: 'Durham University Library digital manuscripts via IIIF',
        },
        {
            name: 'e-codices (Unifr)',
            example: 'https://www.e-codices.ch/en/sbe/0610/1',
            description: 'Swiss virtual manuscript library',
        },
        {
            name: 'e-manuscripta.ch',
            example: 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497',
            description: 'Swiss digital manuscript platform (Zurich libraries)',
        },
        {
            name: 'Florus (BM Lyon)',
            example: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128',
            description: 'Bibliothèque municipale de Lyon digital manuscripts',
        },
        {
            name: 'Florence (ContentDM Plutei)',
            example: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            description: 'Florence digital manuscripts collection via ContentDM with maximum resolution IIIF support (up to 6000px width)',
        },
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres',
            description: 'French National Library digital manuscripts (supports any f{page}.* format)',
        },
        {
            name: 'Grenoble Municipal Library',
            example: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            description: 'Bibliothèque municipale de Grenoble digital manuscripts via Gallica infrastructure',
        },
        {
            name: 'Internet Culturale',
            example: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
            description: 'Italian national digital heritage platform serving manuscripts from BNCF, Laurenziana, and other institutions',
        },
        {
            name: 'Karlsruhe BLB (Badische Landesbibliothek)',
            example: 'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3464606%2Fmanifest',
            description: 'Badische Landesbibliothek Karlsruhe digital manuscripts via IIIF v2.0',
        },
        {
            name: 'IRHT (CNRS)',
            example: 'https://arca.irht.cnrs.fr/ark:/63955/md14nk323d72',
            description: 'Institut de recherche et d\'histoire des textes digital manuscripts',
        },
        {
            name: 'Library of Congress',
            example: 'https://www.loc.gov/item/2010414164/',
            description: 'Library of Congress digital manuscripts and rare books via IIIF v2.0',
        },
        {
            name: 'Laon Bibliothèque',
            example: 'https://bibliotheque-numerique.ville-laon.fr/viewer/1459/?offset=#page=1&viewer=picture&o=download&n=0&q=',
            description: 'Bibliothèque municipale de Laon digital manuscripts',
        },
        {
            name: 'Manchester Digital Collections (John Rylands)',
            example: 'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1',
            description: 'University of Manchester John Rylands Library medieval manuscripts via IIIF v2.0',
        },
        {
            name: 'Manuscripta.se',
            example: 'https://manuscripta.se/ms/101124',
            description: 'Swedish digital catalogue of medieval and early modern manuscripts via IIIF',
        },
        {
            name: 'Modena Diocesan Archive',
            example: 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/',
            description: 'Modena Diocesan Archive digital manuscripts (Flash interface bypassed)',
        },
        {
            name: 'Morgan Library & Museum',
            example: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
            description: 'Morgan Library & Museum digital manuscript collections',
        },
        {
            name: 'NYPL Digital Collections',
            example: 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002',
            description: 'New York Public Library digital manuscript collections',
        },
        {
            name: 'Orléans Médiathèques (Aurelia)',
            example: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380',
            description: 'Médiathèques d\'Orléans digital heritage library via IIIF/Omeka',
        },
        {
            name: 'Real Biblioteca del Monasterio de El Escorial (RBME)',
            example: 'https://rbme.patrimonionacional.es/s/rbme/item/14374',
            description: 'Real Biblioteca del Monasterio de El Escorial digital manuscripts via IIIF',
        },
        {
            name: 'Rome National Library (BNCR)',
            example: 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
            description: 'Biblioteca Nazionale Centrale di Roma digital manuscript collections (manoscrittoantico and libroantico)',
        },
        {
            name: 'SharedCanvas',
            example: 'https://sharedcanvas.be/IIIF/viewer/mirador/B_OB_MS310',
            description: 'SharedCanvas-based digital manuscript viewers and collections',
        },
        {
            name: 'Saint-Omer Municipal Library',
            example: 'https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/?offset=3#page=1&viewer=picture&o=&n=0&q=',
            description: 'Bibliothèque municipale de Saint-Omer medieval manuscripts via IIIF v2.0',
        },
        {
            name: 'Stanford Parker Library',
            example: 'https://parker.stanford.edu/parker/catalog/zs345bj2650',
            description: 'Stanford Parker Library on the Web - digitized manuscripts from Corpus Christi College, Cambridge via IIIF',
        },
        {
            name: 'Trinity College Cambridge',
            example: 'https://mss-cat.trin.cam.ac.uk/Manuscript/B.10.5/UV',
            description: 'Trinity College Cambridge digital manuscripts',
        },
        {
            name: 'University of Toronto (Fisher)',
            example: 'https://collections.library.utoronto.ca/view/fisher2:F6521',
            description: 'University of Toronto Thomas Fisher Rare Book Library manuscripts via IIIF v2.0/v3.0',
        },
        {
            name: 'Fulda University of Applied Sciences',
            example: 'https://fuldig.hs-fulda.de/viewer/image/PPN314755322/2/',
            description: 'Fulda University digital collections with medieval manuscripts via IIIF v2.0',
        },
        {
            name: 'UGent Library',
            example: 'https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C',
            description: 'Ghent University Library digital manuscript collections via IIIF',
        },
        {
            name: 'Unicatt (Ambrosiana)',
            example: 'https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6',
            description: 'Biblioteca Ambrosiana digital manuscripts',
        },
        {
            name: 'University of Graz',
            example: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            description: 'University of Graz digital manuscript collection with IIIF support',
        },
        {
            name: 'Vatican Digital Library',
            example: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
            description: 'Vatican Apostolic Library manuscripts with high-resolution IIIF support (up to 4000px width)',
        },
        {
            name: 'Vienna Manuscripta.at',
            example: 'https://manuscripta.at/diglit/AT5000-1013/0001',
            description: 'Austrian National Library digital manuscript collection',
        },
        {
            name: 'BVPB (Biblioteca Virtual del Patrimonio Bibliográfico)',
            example: 'https://bvpb.mcu.es/es/consulta/registro.do?id=451885',
            description: 'Spanish Virtual Library of Bibliographic Heritage with digitized manuscripts',
        },
        {
            name: 'Europeana Collections',
            example: 'https://www.europeana.eu/en/item/446/CNMD_00000171777',
            description: 'European cultural heritage manuscripts via IIIF manifest API',
        },
        {
            name: 'Monte-Cassino (OMNES)',
            example: 'https://manus.iccu.sbn.it/cnmd/0000313047',
            description: 'Monte-Cassino Abbey manuscripts via OMNES IIIF platform',
        },
        {
            name: 'Vallicelliana Library',
            example: 'https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest',
            description: 'Biblioteca Vallicelliana manuscripts via DAM and JMMS platforms',
        },
        {
            name: 'Omnes Vallicelliana',
            example: 'https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest',
            description: 'Biblioteca Vallicelliana manuscripts via Omnes digital platform',
        },
        {
            name: 'Verona Library (NBM)',
            example: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            description: 'Nuova Biblioteca Manoscritta (Verona) manuscripts via IIIF',
        },
        {
            name: 'DIAMM (Digital Image Archive of Medieval Music)',
            example: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
            description: 'Digital Image Archive of Medieval Music manuscripts (800-1650 AD) via IIIF',
        },
        {
            name: 'MDC Catalonia (Memòria Digital de Catalunya)',
            example: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
            description: 'Catalan digital manuscript collection with historical incunables via IIIF',
        },
        {
            name: 'BVPB (Biblioteca Virtual del Patrimonio Bibliográfico)',
            example: 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651',
            description: 'Spanish virtual library of bibliographic heritage manuscripts and historical documents',
        },
        {
            name: 'ONB (Austrian National Library)',
            example: 'https://viewer.onb.ac.at/1000B160',
            description: 'Austrian National Library digital collections with IIIF v3 support for high-resolution manuscript access',
        },
        {
            name: 'Rouen Municipal Library',
            example: 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom',
            description: 'Bibliothèque municipale de Rouen digital manuscript collections with high-resolution access',
        },
        {
            name: 'University of Freiburg',
            example: 'https://dl.ub.uni-freiburg.de/diglit/codal_25',
            description: 'University of Freiburg digital manuscript collection with METS/MODS metadata and maximum resolution IIIF support',
        },
        {
            name: 'Wolfenbüttel Digital Library (HAB)',
            example: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst or https://diglib.hab.de/varia/selecta/ed000011/start.htm',
            description: 'Herzog August Bibliothek Wolfenbüttel digital manuscript collections with high-resolution access',
        },
        {
            name: 'HHU Düsseldorf (Heinrich-Heine-University)',
            example: 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest',
            description: 'Heinrich-Heine-University Düsseldorf digital manuscripts via IIIF v2.0 with maximum resolution support (up to 4879x6273px)',
        },
    ];

    getSupportedLibraries(): LibraryInfo[] {
        return EnhancedManuscriptDownloaderService.SUPPORTED_LIBRARIES;
    }

    /**
     * Calculate exponential backoff delay with jitter
     */
    calculateRetryDelay(attempt: number): number {
        const baseDelay = configService.get('retryDelayBase');
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), configService.get('retryDelayMax'));
        const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
        return Math.floor(exponentialDelay + jitter);
    }

    /**
     * ETA formatting helper
     */
    formatETA(etaSeconds: number): string {
        if (!etaSeconds || !isFinite(etaSeconds)) return 'calculating...';
        
        const hours = Math.floor(etaSeconds / 3600);
        const minutes = Math.floor((etaSeconds % 3600) / 60);
        const seconds = Math.floor(etaSeconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Sleep utility
     */
    async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Validate Internet Culturale images to detect authentication error pages
     */
    private async validateInternetCulturaleImage(buffer: ArrayBuffer, url: string): Promise<void> {
        // Check for the specific "Preview non disponibile" error page by content, not just size
        // Error pages contain specific text, while legitimate small images are just compressed manuscripts
        
        try {
            // Convert buffer to text to check for error messages
            const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
            
            // Check for actual error text content (case-insensitive)
            const errorTexts = [
                'preview non disponibile',
                'Preview non disponibile', 
                'PREVIEW NON DISPONIBILE',
                'anteprima non disponibile',
                'Anteprima non disponibile',
                'accesso negato',
                'access denied',
                'errore',
                'error'
            ];
            
            const hasErrorText = errorTexts.some(errorText => 
                textContent.toLowerCase().includes(errorText.toLowerCase())
            );
            
            if (hasErrorText) {
                throw new Error(
                    `Internet Culturale authentication error: received error page with text "${errorTexts.find(t => textContent.toLowerCase().includes(t.toLowerCase()))}" instead of manuscript image. ` +
                    `This indicates a session/authentication issue. Image size: ${buffer.byteLength} bytes. ` +
                    `URL: ${url}`
                );
            }
            
            // Validate JPEG structure
            const bytes = new Uint8Array(buffer);
            const isValidJpeg = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;
            
            if (!isValidJpeg) {
                throw new Error(`Invalid JPEG format received from Internet Culturale: ${url}`);
            }
            
            // Log small but valid images for monitoring (some manuscripts have legitimately small images)
            if (buffer.byteLength < 40000) {
                console.log(`Internet Culturale: Small but valid image (${buffer.byteLength} bytes): ${url}`);
            }
            
        } catch (decodingError) {
            // If text decoding fails, it's likely a binary image (which is good)
            // Just verify it's a valid JPEG
            const bytes = new Uint8Array(buffer);
            const isValidJpeg = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;
            
            if (!isValidJpeg) {
                throw new Error(`Invalid JPEG format received from Internet Culturale: ${url}`);
            }
        }
    }

    /**
     * Detect library type from URL
     */
    detectLibrary(url: string): string | null {
        // Check for unsupported libraries first
        if (url.includes('digitalcollections.tcd.ie')) {
            throw new Error('Trinity College Dublin is not currently supported due to aggressive captcha protection. Please download manuscripts manually through their website.');
        }
        
        if (url.includes('digitalcollections.nypl.org')) return 'nypl';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        if ((url.includes('i3f.vls.io') && url.includes('blb-karlsruhe.de')) || url.includes('digital.blb-karlsruhe.de')) return 'karlsruhe';
        if (url.includes('digitalcollections.manchester.ac.uk')) return 'manchester';
        if (url.includes('e-codices.unifr.ch') || url.includes('e-codices.ch')) return 'unifr';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
        if (url.includes('arca.irht.cnrs.fr')) return 'irht';
        if (url.includes('www.loc.gov') || url.includes('tile.loc.gov')) return 'loc';
        if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
        if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
        if (url.includes('iiif.durham.ac.uk')) return 'durham';
        if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
        if (url.includes('bibliotheque-agglo-stomer.fr')) return 'saint_omer';
        if (url.includes('lib.ugent.be')) return 'ugent';
        if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
        if (url.includes('florus.bm-lyon.fr')) return 'florus';
        if (url.includes('digitallibrary.unicatt.it')) return 'unicatt';
        if (url.includes('internetculturale.it')) return 'internet_culturale';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('iiif.library.utoronto.ca') || url.includes('collections.library.utoronto.ca')) return 'toronto';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) return 'orleans';
        if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
        if (url.includes('parker.stanford.edu')) return 'parker';
        if (url.includes('manuscripta.se')) return 'manuscripta';
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('digital.dombibliothek-koeln.de')) return 'cologne';
        if (url.includes('manuscripta.at')) return 'vienna_manuscripta';
        if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome';
        if (url.includes('digital.staatsbibliothek-berlin.de')) return 'berlin';
        if (url.includes('dig.vkol.cz')) return 'czech';
        if (url.includes('archiviodiocesano.mo.it')) return 'modena';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('europeana.eu')) return 'europeana';
        if (url.includes('omnes.dbseret.com/montecassino')) return 'monte_cassino';
        if (url.includes('dam.iccu.sbn.it') || url.includes('jmms.iccu.sbn.it')) return 'vallicelliana';
        if (url.includes('omnes.dbseret.com/vallicelliana')) return 'omnes_vallicelliana';
        if (url.includes('manus.iccu.sbn.it')) return 'iccu_api';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('bvpb.mcu.es')) return 'bvpb';
        if (url.includes('diamm.ac.uk') || url.includes('iiif.diamm.net') || url.includes('musmed.eu/visualiseur-iiif')) return 'diamm';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
        if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
        if (url.includes('viewer.onb.ac.at')) return 'onb';
        if (url.includes('rotomagus.fr')) return 'rouen';
        if (url.includes('dl.ub.uni-freiburg.de')) return 'freiburg';
        if (url.includes('fuldig.hs-fulda.de')) return 'fulda';
        if (url.includes('diglib.hab.de')) return 'wolfenbuettel';
        if (url.includes('digi.vatlib.it')) return 'vatican';
        if (url.includes('digital.ulb.hhu.de')) return 'hhu';
        
        return null;
    }

    /**
     * Proxy servers for regions where libraries might be blocked
     */
    private readonly PROXY_SERVERS = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://proxy.cors.sh/',
    ];

    /**
     * Fetch with automatic proxy fallback
     */
    async fetchWithProxyFallback(url: string, options: any = {}): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), configService.get('requestTimeout'));
        
        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            }
        };
        
        try {
            // Try direct access first
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);
            
            if (response.ok || response.status < 500) {
                return response;
            }
            
            throw new Error(`HTTP ${response.status}`);
        } catch (directError: any) {
            clearTimeout(timeoutId);
            
            // If direct access fails, try proxy servers
            for (const proxy of this.PROXY_SERVERS) {
                try {
                    const proxyController = new AbortController();
                    const proxyTimeoutId = setTimeout(() => proxyController.abort(), configService.get('requestTimeout'));
                    
                    const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
                    const proxyResponse = await fetch(proxyUrl, {
                        ...fetchOptions,
                        signal: proxyController.signal
                    });
                    
                    clearTimeout(proxyTimeoutId);
                    
                    if (proxyResponse.ok) {
                        console.log(`Successfully fetched ${url} via proxy: ${proxy}`);
                        return proxyResponse;
                    }
                } catch (proxyError: any) {
                    console.warn(`Proxy ${proxy} failed for ${url}: ${proxyError.message}`);
                    continue;
                }
            }
            
            // All proxies failed, throw original error
            throw directError;
        }
    }

    /**
     * Direct fetch (no proxy needed in Electron main process)
     */
    async fetchDirect(url: string, options: any = {}, attempt: number = 1): Promise<Response> {
        const startTime = Date.now();
        
        // Always create our own controller for library-specific timeouts
        const controller = new AbortController();
        
        // Detect library and apply optimized timeout
        const library = this.detectLibrary(url) as TLibrary;
        const baseTimeout = configService.get('requestTimeout');
        const timeout = library ? 
            LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library, attempt) :
            baseTimeout;
        
        this.logger.logDownloadStart(library || 'unknown', url, { attempt, method: 'fetchDirect' });
        this.logger.log({
            level: 'debug',
            library: library || 'unknown',
            url,
            message: `Library detected: ${library || 'unknown'}, timeout: ${timeout}ms (base: ${baseTimeout}ms)`,
            details: { library, timeout, baseTimeout, attempt }
        });
        
        // CRITICAL FIX: Always apply library-specific timeout, even with external signals
        // This ensures Graz and other libraries get their proper extended timeouts
        const timeoutId = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            this.logger.logTimeout(library || 'unknown', url, elapsed, attempt);
            console.error(`[fetchDirect] TIMEOUT: Request timed out after ${elapsed}ms (configured timeout: ${timeout}ms) for ${library || 'unknown'} library: ${url}`);
            controller.abort();
        }, timeout);
        
        // Chain external signal if provided
        const externalSignal = options.signal;
        if (externalSignal) {
            const abortListener = () => {
                console.log(`[fetchDirect] External signal aborted for ${url}`);
                controller.abort();
            };
            externalSignal.addEventListener('abort', abortListener);
            
            // Clean up listener when our controller aborts
            controller.signal.addEventListener('abort', () => {
                externalSignal.removeEventListener('abort', abortListener);
            });
        }
        
        // Special headers for ISOS to avoid 403 Forbidden errors
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...options.headers
        };
        
        if (url.includes('isos.dias.ie')) {
            headers = {
                ...headers,
                'Referer': 'https://www.isos.dias.ie/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin'
            };
        }
        
        // Special headers for Cambridge CUDL to avoid 403 Forbidden errors
        if (url.includes('cudl.lib.cam.ac.uk')) {
            headers = {
                ...headers,
                'Referer': 'https://cudl.lib.cam.ac.uk/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
        }
        
        // Special headers for Orleans IIIF to avoid timeout/hanging issues
        if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) {
            headers = {
                ...headers,
                'Referer': 'https://aurelia.orleans.fr/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            };
        }
        
        // Special headers for Stanford Parker Library IIIF to avoid HTTP 406 errors
        if (url.includes('stacks.stanford.edu') || url.includes('dms-data.stanford.edu')) {
            headers = {
                'User-Agent': 'curl/7.68.0',
                'Accept': '*/*'
            };
        }
        
        // Special headers for Internet Culturale to improve performance
        if (url.includes('internetculturale.it')) {
            headers = {
                ...headers,
                'Referer': 'https://www.internetculturale.it/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
        }
        
        // Special headers for University of Graz to improve IIIF compatibility
        if (url.includes('unipub.uni-graz.at')) {
            headers = {
                ...headers,
                'Referer': 'https://unipub.uni-graz.at/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
        }
        
        // Special headers for Rouen Municipal Library to ensure session management
        if (url.includes('rotomagus.fr')) {
            // Extract manuscript ID and page number for proper referer
            const arkMatch = url.match(/ark:\/12148\/([^/?\s]+)/);
            const pageMatch = url.match(/f(\d+)\./);
            
            if (arkMatch && pageMatch) {
                const manuscriptId = arkMatch[1];
                const pageNumber = pageMatch[1];
                const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.item.zoom`;
                
                headers = {
                    ...headers,
                    'Referer': refererUrl,
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                };
            } else {
                // Fallback for non-image URLs (manifest, etc.)
                headers = {
                    ...headers,
                    'Referer': 'https://www.rotomagus.fr/',
                    'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
                };
            }
        }
        
        try {
            // SSL-tolerant fetching for Verona domains with certificate hostname mismatch
            const fetchOptions: any = {
                ...options,
                signal: controller.signal,
                headers
            };
            
            // Verona, Grenoble, Graz, and MDC Catalonia domains benefit from full HTTPS module bypass for better reliability
            if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') || 
                url.includes('pagella.bm-grenoble.fr') || url.includes('unipub.uni-graz.at') || 
                url.includes('mdc.csuc.cat')) {
                const response = await this.fetchWithHTTPS(url, { ...fetchOptions, timeout });
                if (timeoutId) clearTimeout(timeoutId);
                return response;
            }
            
            // BNE domains use SSL bypass approach
            if (url.includes('bdh-rd.bne.es')) {
                if (typeof process !== 'undefined' && process.versions?.node) {
                    const { Agent } = await import('https');
                    fetchOptions.agent = new Agent({
                        rejectUnauthorized: false
                    });
                }
            }
            
            const response = await fetch(url, fetchOptions);
            if (timeoutId) clearTimeout(timeoutId);
            
            const elapsed = Date.now() - startTime;
            
            // Log response headers for debugging
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            
            this.logger.log({
                level: 'info',
                library: library || 'unknown',
                url,
                message: `Response received - Status: ${response.status}, Time: ${elapsed}ms`,
                duration: elapsed,
                details: { 
                    status: response.status, 
                    statusText: response.statusText,
                    headers: responseHeaders,
                    attempt
                }
            });
            
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const size = contentLength ? parseInt(contentLength, 10) : 0;
                this.logger.logDownloadComplete(library || 'unknown', url, elapsed, size);
            }
            
            return response;
        } catch (error: any) {
            if (timeoutId) clearTimeout(timeoutId);
            
            const elapsed = Date.now() - startTime;
            this.logger.logDownloadError(library || 'unknown', url, error, attempt);
            console.error(`[fetchDirect] ERROR after ${elapsed}ms for ${url}:`, error);
            
            throw error;
        }
    }

    /**
     * Specialized fetch for BNE domains using native HTTPS module
     * This fixes Node.js v22.16.0 compatibility issues with fetch API and SSL bypass
     */
    private async fetchBneWithHttps(url: string, options: { method?: string } = {}): Promise<Response> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                rejectUnauthorized: false
            };

            const req = https.request(requestOptions, (res) => {
                const chunks: Buffer[] = [];
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    const body = Buffer.concat(chunks);
                    const response = new Response(body, {
                        status: res.statusCode || 200,
                        statusText: res.statusMessage || 'OK',
                        headers: Object.fromEntries(
                            Object.entries(res.headers).map(([key, value]) => [
                                key,
                                Array.isArray(value) ? value.join(', ') : value || ''
                            ])
                        )
                    });
                    
                    resolve(response);
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            // Using same timeout as fetchWithHTTPS for consistency
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    /**
     * Specialized fetch for Verona domains using native HTTPS module
     * This fixes SSL certificate validation issues with Node.js fetch API
     */
    private async fetchWithHTTPS(url: string, options: any = {}): Promise<Response> {
        const https = await import('https');
        const { URL } = await import('url');
        const dns = await import('dns').then(m => m.promises);
        
        const urlObj = new URL(url);
        
        // Special handling for Graz to resolve ETIMEDOUT issues
        if (url.includes('unipub.uni-graz.at')) {
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                console.log(`[Graz] Pre-resolving DNS for ${urlObj.hostname}`);
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    console.log(`[Graz] Resolved to ${addresses[0]}`);
                }
            } catch (dnsError) {
                console.warn(`[Graz] DNS resolution failed, proceeding anyway:`, dnsError);
            }
        }
        
        // Special handling for Grenoble to resolve DNS issues
        if (url.includes('pagella.bm-grenoble.fr')) {
            try {
                // Pre-resolve DNS to avoid EAI_AGAIN errors
                console.log(`[Grenoble] Pre-resolving DNS for ${urlObj.hostname}`);
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    console.log(`[Grenoble] Resolved to ${addresses[0]}`);
                }
            } catch (dnsError) {
                console.warn(`[Grenoble] DNS resolution failed, proceeding anyway:`, dnsError);
            }
        }
        
        // Create agent with connection pooling for Graz
        const agent = url.includes('unipub.uni-graz.at') ? 
            new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 10,
                maxFreeSockets: 5,
                timeout: 120000,
                rejectUnauthorized: false
            }) : undefined;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            rejectUnauthorized: false,
            // Add extended socket timeout for Graz
            timeout: url.includes('unipub.uni-graz.at') ? 120000 : 30000,
            // Use connection pooling agent for Graz
            agent: agent
        };
        
        // Implement retry logic for connection timeouts
        const maxRetries = url.includes('unipub.uni-graz.at') ? 5 : 1;
        let retryCount = 0;
        const overallStartTime = Date.now(); // Track total time from first attempt
        
        const attemptRequest = (): Promise<Response> => {
            return new Promise((resolve, reject) => {
                const attemptStartTime = Date.now();
                console.log(`[fetchWithHTTPS] Attempt ${retryCount + 1}/${maxRetries} for ${urlObj.hostname}`);
                
                const req = https.request(requestOptions, (res) => {
                const chunks: Buffer[] = [];
                let lastDataTime = Date.now();
                let totalBytes = 0;
                let progressTimer: NodeJS.Timeout;
                
                // Smart timeout: Monitor if data is still flowing
                const PROGRESS_CHECK_INTERVAL = 10000; // Check every 10 seconds
                const STALL_TIMEOUT = 30000; // Timeout if no data for 30 seconds
                const initialTimeout = options.timeout || 30000;
                
                // Clear any existing timeout
                const clearProgressTimer = () => {
                    if (progressTimer) {
                        clearTimeout(progressTimer);
                    }
                };
                
                // Setup progress monitoring
                const setupProgressMonitor = () => {
                    clearProgressTimer();
                    progressTimer = setTimeout(() => {
                        const timeSinceLastData = Date.now() - lastDataTime;
                        if (timeSinceLastData > STALL_TIMEOUT) {
                            req.destroy();
                            reject(new Error(`Download stalled - no data received for ${STALL_TIMEOUT / 1000} seconds (downloaded ${totalBytes} bytes)`));
                        } else {
                            // Still receiving data, continue monitoring
                            console.log(`[fetchWithHTTPS] Download in progress: ${totalBytes} bytes received, last data ${Math.round(timeSinceLastData / 1000)}s ago`);
                            setupProgressMonitor();
                        }
                    }, PROGRESS_CHECK_INTERVAL);
                };
                
                // Initial timeout for connection establishment
                const connectionTimer = setTimeout(() => {
                    if (totalBytes === 0) {
                        req.destroy();
                        reject(new Error(`Connection timeout - no response after ${initialTimeout / 1000} seconds`));
                    }
                }, initialTimeout);
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    totalBytes += chunk.length;
                    lastDataTime = Date.now();
                    
                    // Clear connection timer once we start receiving data
                    if (totalBytes === chunk.length) {
                        clearTimeout(connectionTimer);
                        setupProgressMonitor();
                    }
                });
                
                res.on('end', async () => {
                    clearTimeout(connectionTimer);
                    clearProgressTimer();
                    
                    let body = Buffer.concat(chunks);
                    const responseHeaders = new Headers();
                    
                    console.log(`[fetchWithHTTPS] Download complete: ${totalBytes} bytes in ${Math.round((Date.now() - lastDataTime + STALL_TIMEOUT) / 1000)}s`);
                    
                    Object.entries(res.headers).forEach(([key, value]) => {
                        responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value || '');
                    });
                    
                    // Handle content decompression
                    const contentEncoding = res.headers['content-encoding'];
                    if (contentEncoding) {
                        const zlib = await import('zlib');
                        try {
                            if (contentEncoding === 'gzip') {
                                body = zlib.gunzipSync(body);
                            } else if (contentEncoding === 'deflate') {
                                body = zlib.inflateSync(body);
                            } else if (contentEncoding === 'br') {
                                body = zlib.brotliDecompressSync(body);
                            }
                            // Remove content-encoding header after decompression
                            responseHeaders.delete('content-encoding');
                        } catch (decompressError) {
                            console.error(`Failed to decompress ${contentEncoding} content:`, decompressError);
                            // Continue with compressed body if decompression fails
                        }
                    }
                    
                    const response = new Response(body, {
                        status: res.statusCode || 200,
                        statusText: res.statusMessage || 'OK',
                        headers: responseHeaders
                    });
                    
                    resolve(response);
                });
                
                res.on('error', (error) => {
                    clearTimeout(connectionTimer);
                    clearProgressTimer();
                    reject(error);
                });
            });
            
            req.on('error', (error: any) => {
                const attemptDuration = Date.now() - attemptStartTime;
                console.log(`[fetchWithHTTPS] Request error after ${attemptDuration}ms:`, error.code, error.message);
                
                // Handle connection timeouts with retry for Graz
                if (url.includes('unipub.uni-graz.at') && 
                    (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || 
                     error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
                     error.code === 'ENETUNREACH' || error.code === 'EHOSTUNREACH' ||
                     error.code === 'EPIPE' || error.code === 'ECONNABORTED') && 
                    retryCount < maxRetries - 1) {
                    
                    retryCount++;
                    // More aggressive exponential backoff: 2s, 4s, 8s, 16s, 32s (max 30s)
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    console.log(`[Graz] Connection failed with ${error.code}, retry ${retryCount}/${maxRetries - 1} in ${backoffDelay}ms...`);
                    
                    setTimeout(() => {
                        attemptRequest().then(resolve).catch(reject);
                    }, backoffDelay);
                } else {
                    // Final error or non-retryable error
                    if (error.code === 'ETIMEDOUT' && url.includes('unipub.uni-graz.at')) {
                        const totalTime = Math.round((Date.now() - overallStartTime) / 1000);
                        const actualTimeout = Math.round(timeout / 1000);
                        reject(new Error(`University of Graz connection timeout after ${actualTimeout} seconds (${maxRetries} attempts over ${totalTime} seconds total). The server at ${urlObj.hostname} is not responding. This may be due to high server load or network issues. Please try again later or check if the manuscript is accessible at https://unipub.uni-graz.at/`));
                    } else {
                        reject(error);
                    }
                }
            });
            
            // Add connection timeout handling
            req.on('timeout', () => {
                console.log(`[fetchWithHTTPS] Socket timeout for ${urlObj.hostname}`);
                req.destroy();
                const timeoutError: any = new Error('Socket timeout');
                timeoutError.code = 'ETIMEDOUT';
                req.emit('error', timeoutError);
            });
            
            req.end();
        });
    };
    
    return attemptRequest();
    }

    /**
     * Load manifest for different library types
     */
    async loadManifest(originalUrl: string, progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
        // Check cache first
        const cachedManifest = await this.manifestCache.get(originalUrl);
        if (cachedManifest) {
            return cachedManifest;
        }
        
        const library = this.detectLibrary(originalUrl);
        if (!library) {
            throw new Error(`Unsupported library for URL: ${originalUrl}`);
        }

        let manifest: ManuscriptManifest;
        
        try {
            switch (library) {
                case 'nypl':
                    manifest = await this.loadNyplManifest(originalUrl);
                    break;
                case 'morgan':
                    manifest = await this.loadMorganManifest(originalUrl);
                    break;
                case 'gallica':
                    manifest = await this.loadGallicaManifest(originalUrl);
                    break;
                case 'grenoble':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('grenoble', originalUrl);
                    break;
                case 'karlsruhe':
                    manifest = await this.loadKarlsruheManifest(originalUrl);
                    break;
                case 'manchester':
                    manifest = await this.loadManchesterManifest(originalUrl);
                    break;
                case 'unifr':
                    manifest = await this.loadUnifrManifest(originalUrl);
                    break;
                case 'vatlib':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vatican', originalUrl);
                    break;
                case 'cecilia':
                    manifest = await this.loadCeciliaManifest(originalUrl);
                    break;
                case 'irht':
                    manifest = await this.loadIrhtManifest(originalUrl);
                    break;
                case 'loc':
                    manifest = await this.loadLocManifest(originalUrl);
                    break;
                case 'dijon':
                    manifest = await this.loadDijonManifest(originalUrl);
                    break;
                case 'laon':
                    manifest = await this.loadLaonManifest(originalUrl);
                    break;
                case 'durham':
                    manifest = await this.loadDurhamManifest(originalUrl);
                    break;
                case 'sharedcanvas':
                    manifest = await this.loadSharedCanvasManifest(originalUrl);
                    break;
                case 'saint_omer':
                    manifest = await this.loadSaintOmerManifest(originalUrl);
                    break;
                case 'ugent':
                    manifest = await this.loadUgentManifest(originalUrl);
                    break;
                case 'bl':
                    manifest = await this.loadBLManifest(originalUrl);
                    break;
                case 'florus':
                    manifest = await this.loadFlorusManifest(originalUrl);
                    break;
                case 'unicatt':
                    manifest = await this.loadUnicattManifest(originalUrl);
                    break;
                case 'cudl':
                    manifest = await this.loadCudlManifest(originalUrl);
                    break;
                case 'trinity_cam':
                    manifest = await this.loadTrinityCamManifest(originalUrl);
                    break;
                case 'toronto':
                    manifest = await this.loadTorontoManifest(originalUrl);
                    break;
                case 'isos':
                    manifest = await this.loadIsosManifest(originalUrl);
                    break;
                case 'mira':
                    manifest = await this.loadMiraManifest(originalUrl);
                    break;
                case 'orleans':
                    manifest = await this.loadOrleansManifest(originalUrl, progressCallback);
                    break;
                case 'rbme':
                    manifest = await this.loadRbmeManifest(originalUrl);
                    break;
                case 'parker':
                    manifest = await this.loadParkerManifest(originalUrl);
                    break;
                case 'manuscripta':
                    manifest = await this.loadManuscriptaManifest(originalUrl);
                    break;
                case 'internet_culturale':
                    manifest = await this.loadInternetCulturaleManifest(originalUrl);
                    break;
                case 'graz':
                    manifest = await this.loadGrazManifest(originalUrl);
                    break;
                case 'cologne':
                    manifest = await this.loadCologneManifest(originalUrl);
                    break;
                case 'vienna_manuscripta':
                    manifest = await this.loadViennaManuscriptaManifest(originalUrl);
                    break;
                case 'rome':
                    manifest = await this.loadRomeManifest(originalUrl);
                    break;
                case 'berlin':
                    manifest = await this.loadBerlinManifest(originalUrl);
                    break;
                case 'czech':
                    manifest = await this.loadCzechManifest(originalUrl);
                    break;
                case 'modena':
                    manifest = await this.loadModenaManifest(originalUrl);
                    break;
                case 'bdl':
                    // Use shared manifest loader (sync with validation)
                    console.log('[BDL] Using shared manifest loader for consistent behavior');
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bdl', originalUrl);
                    break;
                case 'europeana':
                    manifest = await this.loadEuropeanaManifest(originalUrl);
                    break;
                case 'e_manuscripta':
                    manifest = await this.loadEManuscriptaManifest(originalUrl);
                    break;
                case 'monte_cassino':
                    manifest = await this.loadMonteCassinoManifest(originalUrl);
                    break;
                case 'vallicelliana':
                    manifest = await this.loadVallicellianManifest(originalUrl);
                    break;
                case 'omnes_vallicelliana':
                    manifest = await this.loadOmnesVallicellianManifest(originalUrl);
                    break;
                case 'iccu_api':
                    manifest = await this.loadIccuApiManifest(originalUrl);
                    break;
                case 'verona':
                    // Use shared manifest loader (sync with validation)
                    console.log('[Verona] Using shared manifest loader for consistent behavior');
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('verona', originalUrl);
                    break;
                case 'diamm':
                    manifest = await this.loadDiammManifest(originalUrl);
                    break;
                case 'bne':
                    manifest = await this.loadBneManifest(originalUrl);
                    break;
                case 'mdc_catalonia':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('mdc_catalonia', originalUrl);
                    break;
                case 'bvpb':
                    manifest = await this.loadBvpbManifest(originalUrl);
                    break;
                case 'florence':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('florence', originalUrl);
                    break;
                case 'onb':
                    manifest = await this.loadOnbManifest(originalUrl);
                    break;
                case 'rouen':
                    manifest = await this.loadRouenManifest(originalUrl);
                    break;
                case 'freiburg':
                    manifest = await this.loadFreiburgManifest(originalUrl);
                    break;
                case 'fulda':
                    manifest = await this.loadFuldaManifest(originalUrl);
                    break;
                case 'wolfenbuettel':
                    manifest = await this.loadWolfenbuettelManifest(originalUrl);
                    break;
                case 'vatican':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vatican', originalUrl);
                    break;
                case 'hhu':
                    manifest = await this.loadHhuManifest(originalUrl);
                    break;
                default:
                    throw new Error(`Unsupported library: ${library}`);
            }
            
            manifest.library = library as any;
            manifest.originalUrl = originalUrl;
            
            // Cache the manifest
            await this.manifestCache.set(originalUrl, manifest);
            
            return manifest;
            
        } catch (error: any) {
            console.error(`Failed to load manifest: ${(error as Error).message}`);
            
            // Enhanced error handling for specific network issues
            if (error.code === 'ETIMEDOUT' && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz connection timeout. The server is not responding - this may be due to high load or network issues. Please try again later or check if the manuscript is accessible through the Graz website.`);
            }
            
            if (error.code === 'ECONNRESET' && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz connection was reset. The server closed the connection unexpectedly. Please try again in a few moments.`);
            }
            
            if (error.message?.includes('timeout') && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz request timed out. Large manuscripts may take longer to load - please try again with patience, as the system allows extended timeouts for Graz manuscripts.`);
            }
            
            throw error;
        }
    }

    /**
     * Load Morgan Library & Museum manifest
     */
    async loadMorganManifest(morganUrl: string): Promise<ManuscriptManifest> {
        try {
            // Check if this is a direct image URL
            if (morganUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
                // Extract filename for display name
                const filename = morganUrl.split('/').pop() || 'Morgan Image';
                const displayName = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').replace(/_/g, ' ');
                
                return {
                    pageLinks: [morganUrl],
                    totalPages: 1,
                    displayName,
                    library: 'morgan',
                    originalUrl: morganUrl
                };
            }
            
            // Handle different Morgan URL patterns
            let baseUrl: string;
            let displayName: string = 'Morgan Library Manuscript';
            
            if (morganUrl.includes('ica.themorgan.org')) {
                // ICA format: https://ica.themorgan.org/manuscript/thumbs/159109
                const icaMatch = morganUrl.match(/\/manuscript\/thumbs\/(\d+)/);
                if (!icaMatch) {
                    throw new Error('Invalid Morgan ICA URL format');
                }
                baseUrl = 'https://ica.themorgan.org';
                displayName = `Morgan ICA Manuscript ${icaMatch[1]}`;
            } else {
                // Main format: https://www.themorgan.org/collection/lindau-gospels/thumbs
                // or https://www.themorgan.org/collection/gospel-book/159129
                const mainMatch = morganUrl.match(/\/collection\/([^/]+)(?:\/(\d+))?(?:\/thumbs)?/);
                if (!mainMatch) {
                    throw new Error('Invalid Morgan URL format');
                }
                baseUrl = 'https://www.themorgan.org';
                
                // Extract display name from URL
                displayName = mainMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            // Ensure we're fetching the correct page
            // FIXED: Don't append /thumbs anymore as it causes redirects/404s
            let pageUrl = morganUrl;
            // Remove /thumbs if present (except for ICA format which still uses it)
            if (!morganUrl.includes('ica.themorgan.org') && pageUrl.includes('/thumbs')) {
                pageUrl = pageUrl.replace('/thumbs', '');
                console.log('Morgan: Removed /thumbs suffix to avoid redirect');
            }
            
            // Fetch the page to extract image data
            const pageResponse = await this.fetchDirect(pageUrl);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch Morgan page: ${pageResponse.status}`);
            }
            
            const pageContent = await pageResponse.text();
            
            // Extract image URLs from the page
            const pageLinks: string[] = [];
            
            if (morganUrl.includes('ica.themorgan.org')) {
                // ICA format - look for image references
                const icaImageRegex = /icaimages\/\d+\/[^"']+\.jpg/g;
                const icaMatches = pageContent.match(icaImageRegex) || [];
                
                for (const match of icaMatches) {
                    const fullUrl = `https://ica.themorgan.org/${match}`;
                    if (!pageLinks.includes(fullUrl)) {
                        pageLinks.push(fullUrl);
                    }
                }
            } else {
                // Main Morgan format - MAXIMUM RESOLUTION priority system
                // FIXED: Prioritize ZIF files for ultra-high resolution (6000x4000+ pixels, 25MP+)
                const imagesByPriority: { [key: number]: string[] } = {
                    0: [], // HIGHEST PRIORITY: .zif tiled images (ULTRA HIGH RESOLUTION 6000x4000+ pixels, 25MP+)
                    1: [], // NEW: High-resolution download URLs (749KB avg, 16.6x improvement)
                    2: [], // High priority: direct full-size images  
                    3: [], // Medium priority: converted styled images (reliable multi-page)
                    4: [], // Low priority: facsimile images
                    5: []  // Lowest priority: other direct references
                };
                
                // Priority 0: Generate .zif URLs from image references (MAXIMUM RESOLUTION - 25+ megapixels)
                // OPTIMIZED: Single regex with capture groups to avoid redundant operations
                const manuscriptMatch = morganUrl.match(/\/collection\/([^/]+)/);
                if (manuscriptMatch) {
                    const manuscriptId = manuscriptMatch[1];
                    const imageIdRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
                    const validImagePattern = /\d+v?_\d+/;
                    
                    let match;
                    while ((match = imageIdRegex.exec(pageContent)) !== null) {
                        const imageId = match[1];
                        // FIXED: Use correct pattern for Lindau Gospels (76874v_*) and similar manuscripts
                        if (validImagePattern.test(imageId) && !imageId.includes('front-cover')) {
                            const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
                            imagesByPriority[0].push(zifUrl);
                        }
                    }
                    
                    // Priority 1: NEW - High-resolution download URLs (16.6x improvement validated)
                    // Parse individual manuscript pages for download URLs
                    try {
                        // Extract individual page URLs from thumbs page
                        const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
                        const pageMatches = [...pageContent.matchAll(pageUrlRegex)];
                        const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
                        
                        // Also try alternative patterns for page detection
                        const altPatterns = [
                            new RegExp(`href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"`, 'g'),
                            new RegExp(`data-page="(\\d+)"`, 'g'),
                            new RegExp(`page-(\\d+)`, 'g')
                        ];
                        
                        for (const pattern of altPatterns) {
                            const altMatches = [...pageContent.matchAll(pattern)];
                            for (const match of altMatches) {
                                uniquePages.push(match[1]);
                            }
                        }
                        
                        // Remove duplicates and sort
                        const allUniquePages = [...new Set(uniquePages)].sort((a, b) => parseInt(a) - parseInt(b));
                        
                        console.log(`Morgan: Found ${allUniquePages.length} individual pages for ${manuscriptId}`);
                        console.log(`Morgan: Page numbers detected: ${allUniquePages.slice(0, 10).join(', ')}${allUniquePages.length > 10 ? '...' : ''}`);
                        this.logInfo('morgan', morganUrl, 'Morgan page detection complete', {
                            manuscriptId,
                            totalPagesDetected: allUniquePages.length,
                            pageNumbers: allUniquePages.slice(0, 20),
                            detectionMethod: 'multiple patterns'
                        });
                        
                        // Process all pages - removed artificial limit
                        const pagesToProcess = allUniquePages;
                        
                        // Parse each individual page for high-resolution download URLs
                        for (const pageNum of pagesToProcess) {
                            try {
                                const pageUrl = `${baseUrl}/collection/${manuscriptId}/${pageNum}`;
                                const individualPageResponse = await this.fetchDirect(pageUrl);
                                
                                if (individualPageResponse.ok) {
                                    const individualPageContent = await individualPageResponse.text();
                                    
                                    // FIXED: Look for facsimile images on individual pages
                                    const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/);
                                    if (facsimileMatch) {
                                        const downloadUrl = `${baseUrl}${facsimileMatch[0]}`;
                                        imagesByPriority[1].push(downloadUrl);
                                        console.log(`Morgan: Found high-res facsimile: ${facsimileMatch[1]}`);
                                    }
                                }
                                
                                // Rate limiting to be respectful to Morgan's servers
                                await new Promise(resolve => setTimeout(resolve, 300));
                                
                            } catch (error) {
                                console.warn(`Morgan: Error parsing individual page ${pageNum}: ${(error as Error).message}`);
                            }
                        }
                        
                        if (imagesByPriority[1].length > 0) {
                            console.log(`Morgan: Successfully found ${imagesByPriority[1].length} high-resolution download URLs`);
                        }
                        
                    } catch (error) {
                        console.warn(`Morgan: Error in high-resolution download URL parsing: ${(error as Error).message}`);
                    }
                }
                
                // Priority 2: Look for direct full-size image references
                const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
                const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
                
                for (const match of fullSizeMatches) {
                    const fullUrl = `${baseUrl}${match}`;
                    imagesByPriority[2].push(fullUrl);
                }
                
                // Priority 3: Extract styled images converted to original (fallback for reliability)
                const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
                const styledMatches = pageContent.match(styledImageRegex) || [];
                
                for (const match of styledMatches) {
                    // Convert styled image to original high-resolution version
                    // From: /sites/default/files/styles/large__650_x_650_/public/images/collection/filename.jpg
                    // To: /sites/default/files/images/collection/filename.jpg
                    const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
                    const fullUrl = `${baseUrl}${originalPath}`;
                    imagesByPriority[3].push(fullUrl);
                }
                
                // Priority 4: Fallback to facsimile images (legacy format)
                const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
                const facsimileMatches = pageContent.match(facsimileRegex) || [];
                
                for (const match of facsimileMatches) {
                    const fullUrl = `${baseUrl}${match}`;
                    imagesByPriority[4].push(fullUrl);
                }
                
                // Priority 5: Other direct image references
                const directImageRegex = /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g;
                const directMatches = pageContent.match(directImageRegex) || [];
                
                for (const match of directMatches) {
                    if (match.includes('facsimile') || match.includes('images/collection')) {
                        imagesByPriority[5].push(match);
                    }
                }
                
                // Select highest quality images based on priority - OPTIMIZED O(n) algorithm
                const getFilenameFromUrl = (url: string) => {
                    const match = url.match(/([^/]+)\.(jpg|zif)$/);
                    return match ? match[1] : url;
                };
                
                // Use Map for O(n) deduplication instead of O(n²) Set operations
                const filenameMap = new Map<string, string>();
                
                // Add images by priority, avoiding duplicates based on filename
                for (let priority = 0; priority <= 5; priority++) {
                    for (const imageUrl of imagesByPriority[priority]) {
                        const filename = getFilenameFromUrl(imageUrl);
                        if (!filenameMap.has(filename)) {
                            filenameMap.set(filename, imageUrl);
                            pageLinks.push(imageUrl);
                        }
                    }
                }
            }
            
            // Try to extract title from page content
            const titleMatch = pageContent.match(/<title[^>]*>([^<]+)</i);
            if (titleMatch) {
                const pageTitle = titleMatch[1].replace(/\s*\|\s*The Morgan Library.*$/i, '').trim();
                if (pageTitle && pageTitle !== 'The Morgan Library & Museum') {
                    displayName = pageTitle;
                }
            }
            
            // Look for manuscript identifier in content
            const msMatch = pageContent.match(/MS\s+M\.?\s*(\d+)/i);
            if (msMatch) {
                displayName = `${displayName} (MS M.${msMatch[1]})`;
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No images found on Morgan Library page');
            }
            
            // Remove duplicates and sort
            const uniquePageLinks = [...new Set(pageLinks)].sort();
            
            // Log priority distribution for debugging
            console.log(`Morgan: Image quality distribution:`);
            console.log(`  - Priority 0 (ZIF ultra-high res): ${imagesByPriority[0].length} images`);
            console.log(`  - Priority 1 (High-res facsimile): ${imagesByPriority[1].length} images`);
            console.log(`  - Priority 2 (Direct full-size): ${imagesByPriority[2].length} images`);
            console.log(`  - Priority 3 (Converted styled): ${imagesByPriority[3].length} images`);
            console.log(`  - Priority 4 (Legacy facsimile): ${imagesByPriority[4].length} images`);
            console.log(`  - Priority 5 (Other direct): ${imagesByPriority[5].length} images`);
            console.log(`Morgan: Total unique images: ${uniquePageLinks.length}`);
            
            const morganManifest = {
                pageLinks: uniquePageLinks,
                totalPages: uniquePageLinks.length,
                library: 'morgan' as const,
                displayName,
                originalUrl: morganUrl,
            };
            
            return morganManifest;
            
        } catch (error: any) {
            console.error(`Failed to load Morgan manifest: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Load NYPL Digital Collections manifest
     */
    async loadNyplManifest(nyplUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract UUID from URL like https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002
            const uuidMatch = nyplUrl.match(/\/items\/([a-f0-9-]+)/);
            if (!uuidMatch) {
                throw new Error('Invalid NYPL URL format');
            }
            
            const uuid = uuidMatch[1];
            
            // Fetch the main page to extract parent collection data
            const pageResponse = await this.fetchDirect(nyplUrl);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch NYPL page: ${pageResponse.status}`);
            }
            
            const pageContent = await pageResponse.text();
            
            // Extract parent UUID from captures API endpoint in the page data
            const capturesUrlMatch = pageContent.match(/data-fetch-url="([^"]*\/items\/([a-f0-9-]+)\/captures[^"]*)"/);
            let pageLinks: string[] = [];
            let displayName = `NYPL Document ${uuid}`;
            
            if (capturesUrlMatch) {
                const capturesPath = capturesUrlMatch[1];
                const parentUuid = capturesUrlMatch[2];
                
                console.log(`NYPL: Found parent collection ${parentUuid}, fetching complete manifest`);
                
                try {
                    // Call the captures API to get all pages
                    const capturesUrl = `https://digitalcollections.nypl.org${capturesPath}?per_page=500`;
                    const capturesResponse = await this.fetchDirect(capturesUrl);
                    
                    if (capturesResponse.ok) {
                        const capturesData = await capturesResponse.json();
                        
                        if (capturesData.response?.captures && Array.isArray(capturesData.response.captures)) {
                            const captures = capturesData.response.captures;
                            
                            console.log(`NYPL: Retrieved ${captures.length} pages from captures API (total: ${capturesData.response.total})`);
                            
                            // Extract image IDs and construct high-resolution image URLs
                            pageLinks = captures.map((item: any) => {
                                if (!item.image_id) {
                                    throw new Error(`Missing image_id for capture ${item.id || 'unknown'}`);
                                }
                                // Use iiif-prod.nypl.org format for full resolution images (&t=g parameter)
                                return `https://iiif-prod.nypl.org/index.php?id=${item.image_id}&t=g`;
                            });
                            
                            // Extract display name from the first capture
                            if (captures[0]?.title) {
                                displayName = captures[0].title;
                            }
                        }
                    }
                } catch (apiError: any) {
                    console.warn(`NYPL: Captures API failed (${apiError.message}), falling back to carousel data`);
                }
            }
            
            // Fallback to original carousel method if captures API failed or no data
            if (pageLinks.length === 0) {
                console.log('NYPL: Using fallback carousel data method');
                
                // Extract carousel data which contains image IDs
                const carouselMatch = pageContent.match(/data-items="([^"]+)"/);
                if (!carouselMatch) {
                    throw new Error('Could not find carousel data in NYPL page');
                }
                
                // Decode HTML entities and parse JSON
                const carouselDataHtml = carouselMatch[1];
                const carouselDataJson = carouselDataHtml
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, '&');
                
                let carouselItems;
                try {
                    carouselItems = JSON.parse(carouselDataJson);
                } catch (error: any) {
                    throw new Error(`Failed to parse carousel JSON: ${(error as Error).message}`);
                }
                
                if (!Array.isArray(carouselItems) || carouselItems.length === 0) {
                    throw new Error('No carousel items found');
                }
                
                // Extract image IDs and construct high-resolution image URLs
                pageLinks = carouselItems.map((item: any) => {
                    if (!item.image_id) {
                        throw new Error(`Missing image_id for item ${item.id || 'unknown'}`);
                    }
                    // Use iiif-prod.nypl.org format for full resolution images (&t=g parameter)
                    return `https://iiif-prod.nypl.org/index.php?id=${item.image_id}&t=g`;
                });
                
                // Extract display name from the first item or fallback to title from item_data
                if (carouselItems[0]?.title_full) {
                    displayName = carouselItems[0].title_full;
                } else if (carouselItems[0]?.title) {
                    displayName = carouselItems[0].title;
                } else {
                    // Fallback: try to extract from item_data as well
                    const itemDataMatch = pageContent.match(/var\s+item_data\s*=\s*({.*?});/s);
                    if (itemDataMatch) {
                        try {
                            const itemData = JSON.parse(itemDataMatch[1]);
                            if (itemData.title) {
                                displayName = Array.isArray(itemData.title) ? itemData.title[0] : itemData.title;
                            }
                        } catch {
                            // Ignore parsing errors for fallback title
                        }
                    }
                }
                
                console.warn(`NYPL: Using carousel fallback method - got ${pageLinks.length} pages. If this manuscript has more pages, there may be an issue with the captures API.`);
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in NYPL manifest');
            }
            
            const nyplManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'nypl' as const,
                displayName,
                originalUrl: nyplUrl,
            };
            
            console.log(`NYPL: Created manifest for "${displayName}" with ${pageLinks.length} pages`);
            
            return nyplManifest;
            
        } catch (error: any) {
            console.error(`Failed to load NYPL manifest: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Load Gallica manifest (using IIIF manifest API)
     */
    async loadGallicaManifest(gallicaUrl: string): Promise<ManuscriptManifest> {
        try {
            const arkMatch = gallicaUrl.match(/ark:\/[^/]+\/[^/?\s]+/);
            if (!arkMatch) {
                throw new Error('Invalid Gallica URL format');
            }
            
            const ark = arkMatch[0];
            
            // Try IIIF manifest first to get page count and metadata (modern approach)
            const manifestUrl = `https://gallica.bnf.fr/iiif/${ark}/manifest.json`;
            
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl);
                if (manifestResponse.ok) {
                    const manifest = await manifestResponse.json();
                    
                    // Extract page count and metadata from IIIF manifest
                    let displayName = `Gallica Document ${ark}`;
                    let totalPages = 0;
                    
                    if (manifest.label) {
                        displayName = typeof manifest.label === 'string' ? manifest.label : 
                                     manifest.label.en?.[0] || manifest.label.fr?.[0] || displayName;
                    }
                    
                    // IIIF Presentation API v2 or v3
                    const sequences = manifest.sequences || [manifest];
                    
                    for (const sequence of sequences) {
                        const canvases = sequence.canvases || sequence.items || [];
                        totalPages += canvases.length;
                    }
                    
                    if (totalPages > 0) {
                        // Use the working .highres format instead of broken IIIF URLs
                        const pageLinks: string[] = [];
                        for (let i = 1; i <= totalPages; i++) {
                            const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
                            pageLinks.push(imageUrl);
                        }
                        
                        const gallicaManifest = {
                            pageLinks,
                            totalPages: pageLinks.length,
                            library: 'gallica' as const,
                            displayName,
                            originalUrl: gallicaUrl,
                        };
                        
                        // Cache the manifest
                        this.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
                        
                        return gallicaManifest;
                    }
                }
            } catch {
                // IIIF manifest failed, try fallback
            }
            
            // Fallback: Direct .highres testing approach (using working URL format)
            
            // Test if we can access .highres images directly and find the page count
            let totalPages = 0;
            
            // Binary search to find total pages efficiently
            let low = 1;
            let high = 1000; // reasonable upper bound
            let lastValidPage = 0;
            
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const testUrl = `https://gallica.bnf.fr/${ark}/f${mid}.highres`;
                
                try {
                    const response = await this.fetchDirect(testUrl);
                    if (response.ok) {
                        lastValidPage = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                } catch {
                    high = mid - 1;
                }
            }
            
            totalPages = lastValidPage;
            
            if (totalPages === 0) {
                // Try a few common page counts
                const commonCounts = [1, 2, 5, 10, 20, 50, 100];
                for (const count of commonCounts) {
                    const testUrl = `https://gallica.bnf.fr/${ark}/f${count}.highres`;
                    try {
                        const response = await this.fetchDirect(testUrl);
                        if (response.ok) {
                            totalPages = count;
                        } else {
                            break;
                        }
                    } catch {
                        break;
                    }
                }
            }
            
            if (totalPages === 0) {
                throw new Error('Could not determine page count for Gallica document');
            }
            
            // Generate .highres image URLs
            const pageLinks = [];
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
                pageLinks.push(imageUrl);
            }
            
            
            const gallicaManifest = {
                pageLinks,
                totalPages,
                library: 'gallica' as const,
                displayName: `Gallica Document ${ark}`,
                originalUrl: gallicaUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
            
            return gallicaManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Gallica document: ${(error as Error).message}`);
        }
    }

    /**
     * Load Grenoble manifest (using IIIF v1.1 API)
     */
    async loadGrenobleManifest(grenobleUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract document ID from URL
            const idMatch = grenobleUrl.match(/\/([^/]+)\/f\d+/);
            if (!idMatch) {
                throw new Error('Invalid Grenoble URL format - document ID not found');
            }
            
            const documentId = idMatch[1];
            let displayName = `Grenoble Manuscript ${documentId}`;
            
            // Use IIIF manifest endpoint with correct ARK path
            const manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/manifest.json`;
            
            try {
                const response = await this.fetchDirect(manifestUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'application/json,*/*'
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} from manifest endpoint`);
                }
                
                const manifest = await response.json();
                
                // Extract metadata from IIIF manifest
                if (manifest.label) {
                    displayName = manifest.label;
                }
                
                // Get page count from sequences/canvases (IIIF v1.1 format)
                let totalPages = 0;
                if (manifest.sequences && manifest.sequences.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases) {
                        totalPages = sequence.canvases.length;
                    }
                }
                
                if (totalPages === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                // Generate IIIF image URLs with maximum resolution
                const pageLinks: string[] = [];
                for (let i = 1; i <= totalPages; i++) {
                    // Use IIIF Image API v1.1 format with maximum resolution: /full/4000,/0/default.jpg
                    // This provides 4000x5020 pixels instead of the default 3164x3971
                    const imageUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/f${i}/full/4000,/0/default.jpg`;
                    pageLinks.push(imageUrl);
                }
                
                const grenobleManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'grenoble' as const,
                    displayName,
                    originalUrl: grenobleUrl,
                };
                
                // Cache the manifest
                this.manifestCache.set(grenobleUrl, grenobleManifest).catch(console.warn);
                
                return grenobleManifest;
                
            } catch (manifestError) {
                throw new Error(`Failed to load IIIF manifest: ${(manifestError as Error).message}`);
            }
            
        } catch (error: any) {
            throw new Error(`Failed to load Grenoble manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Karlsruhe BLB manifest (IIIF v2.0 via i3f.vls.io viewer)
     */
    async loadKarlsruheManifest(karlsruheUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            
            if (karlsruheUrl.includes('i3f.vls.io')) {
                // Extract manifest URL from i3f viewer URL
                // URL format: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F[ID]%2Fmanifest
                const urlParams = new URLSearchParams(new URL(karlsruheUrl).search);
                const encodedManifestUrl = urlParams.get('id');
                
                if (!encodedManifestUrl) {
                    throw new Error('Could not extract manifest URL from Karlsruhe viewer URL');
                }
                
                manifestUrl = decodeURIComponent(encodedManifestUrl);
            } else if (karlsruheUrl.includes('digital.blb-karlsruhe.de/blbhs/content/titleinfo/')) {
                // Direct BLB URL format: https://digital.blb-karlsruhe.de/blbhs/content/titleinfo/3464606
                const idMatch = karlsruheUrl.match(/titleinfo\/(\d+)/);
                if (!idMatch) {
                    throw new Error('Could not extract ID from Karlsruhe direct URL');
                }
                const id = idMatch[1];
                manifestUrl = `https://digital.blb-karlsruhe.de/i3f/v20/${id}/manifest`;
            } else {
                throw new Error('Unsupported Karlsruhe URL format');
            }
            
            let displayName = 'Karlsruhe BLB Manuscript';
            
            // Load IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: HTTP ${response.status}`);
            }
            
            const manifest = await response.json();
            
            // Extract metadata from IIIF v2.0 manifest
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (Array.isArray(manifest.label)) {
                    displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                }
            }
            
            // Get page count from sequences/canvases (IIIF v2.0)
            let totalPages = 0;
            const pageLinks: string[] = [];
            
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases && Array.isArray(sequence.canvases)) {
                    totalPages = sequence.canvases.length;
                    
                    // Extract image URLs with maximum resolution
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource['@id']) {
                                // Extract base image ID and construct maximum resolution URL
                                const imageId = image.resource['@id'];
                                
                                // For Karlsruhe, use direct webcache/2000/ access for maximum resolution
                                // Testing showed: webcache/2000/=821KB vs IIIF=269KB (4x quality improvement)
                                // Extract webcache ID from URL like: https://digital.blb-karlsruhe.de/download/webcache/1000/221191
                                const webcacheMatch = imageId.match(/webcache\/\d+\/(\d+)/);
                                
                                let maxResUrl: string;
                                if (webcacheMatch) {
                                    // Use maximum available webcache resolution (2000px is highest available)
                                    maxResUrl = `https://digital.blb-karlsruhe.de/download/webcache/2000/${webcacheMatch[1]}`;
                                } else {
                                    // Try to extract ID from other patterns and construct webcache URL
                                    // First try IIIF pattern: .../iiif/ID/full/...
                                    let idMatch = imageId.match(/\/iiif\/(\d+)\/full/);
                                    if (!idMatch) {
                                        // Try general numeric pattern at end: .../ID or .../ID.jpg
                                        idMatch = imageId.match(/(\d+)(?:\.jpg)?$/);
                                    }
                                    
                                    if (idMatch) {
                                        maxResUrl = `https://digital.blb-karlsruhe.de/download/webcache/2000/${idMatch[1]}`;
                                    } else {
                                        // Last resort: use IIIF format (lower quality but better than nothing)
                                        maxResUrl = imageId.includes('/full/') ? 
                                            imageId.replace('/full/full/0/default.jpg', '/full/2000,/0/default.jpg') :
                                            imageId;
                                    }
                                }
                                pageLinks.push(maxResUrl);
                            }
                        }
                    }
                }
            }
            
            if (totalPages === 0 || pageLinks.length === 0) {
                throw new Error('No pages found in IIIF manifest');
            }
            
            const karlsruheManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'karlsruhe' as const,
                displayName,
                originalUrl: karlsruheUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(karlsruheUrl, karlsruheManifest).catch(console.warn);
            
            return karlsruheManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Karlsruhe manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Manchester Digital Collections manifest (IIIF v2.0)
     */
    async loadManchesterManifest(manchesterUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL
            // URL format: https://www.digitalcollections.manchester.ac.uk/view/{MANUSCRIPT_ID}/{PAGE_NUMBER}
            const urlMatch = manchesterUrl.match(/\/view\/([^/]+)/);
            if (!urlMatch) {
                throw new Error('Could not extract manuscript ID from Manchester URL');
            }
            
            const manuscriptId = urlMatch[1];
            let displayName = `Manchester Digital Collections - ${manuscriptId}`;
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
            
            // Load IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: HTTP ${response.status}`);
            }
            
            const manifest = await response.json();
            
            // Extract metadata from IIIF v2.0 manifest
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (Array.isArray(manifest.label)) {
                    displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                }
            }
            
            // Get page count from sequences/canvases (IIIF v2.0)
            let totalPages = 0;
            const pageLinks: string[] = [];
            
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases && Array.isArray(sequence.canvases)) {
                    totalPages = sequence.canvases.length;
                    
                    // Extract image URLs with maximum resolution
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource.service && image.resource.service['@id']) {
                                // FIXED: Use optimal resolution pattern discovered through testing
                                // Manchester IIIF service supports maximum 2000x2000 pixels
                                // Pattern /full/1994,2800/0/default.jpg provides highest quality
                                const serviceId = image.resource.service['@id'];
                                const maxResUrl = `${serviceId}/full/1994,2800/0/default.jpg`;
                                
                                pageLinks.push(maxResUrl);
                            }
                        }
                    }
                }
            }
            
            if (totalPages === 0 || pageLinks.length === 0) {
                throw new Error('No pages found in IIIF manifest');
            }
            
            const manchesterManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'manchester' as const,
                displayName,
                originalUrl: manchesterUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(manchesterUrl, manchesterManifest).catch(console.warn);
            
            return manchesterManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Manchester manuscript: ${(error as Error).message}`);
        }
    }



    /**
     * Load IIIF manifest (for Vatican, Durham, UGent, British Library)
     */
    async loadIIIFManifest(manifestUrl: string): Promise<ManuscriptManifest> {
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        let manifest;
        try {
            manifest = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        
        const pageLinks: string[] = [];
        
        // Handle IIIF v3 format (items directly in manifest) and IIIF v2 format (sequences)
        let canvases: any[] = [];
        
        if (manifest.items && Array.isArray(manifest.items)) {
            // IIIF v3: canvases are directly in manifest.items
            canvases = manifest.items;
        } else if (manifest.sequences && Array.isArray(manifest.sequences)) {
            // IIIF v2: canvases are in sequences
            for (const sequence of manifest.sequences) {
                const sequenceCanvases = sequence.canvases || [];
                canvases.push(...sequenceCanvases);
            }
        } else {
            // Fallback: try to find canvases in the manifest itself
            canvases = manifest.canvases || [];
        }
        
        // Process each canvas to extract image URLs
        for (const canvas of canvases) {
            let foundImages = false;
            
            // Check if this looks like IIIF v2 (has canvas.images)
            if (canvas.images && Array.isArray(canvas.images)) {
                for (const image of canvas.images) {
                    let imageUrl;
                    
                    // IIIF v2 format
                    if (image.resource) {
                        imageUrl = image.resource['@id'] || image.resource.id;
                    } else if (image['@id']) {
                        imageUrl = image['@id'];
                    }
                    
                    if (imageUrl) {
                        // const originalUrl = imageUrl;
                        // Convert to full resolution for all IIIF libraries
                        if (imageUrl.includes('/full/')) {
                            imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                        }
                        pageLinks.push(imageUrl);
                        foundImages = true;
                    }
                }
            }
            
            // Check if this looks like IIIF v3 (has canvas.items with AnnotationPages)
            if (!foundImages && canvas.items && Array.isArray(canvas.items)) {
                for (const item of canvas.items) {
                    if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                        for (const annotation of item.items) {
                            if (annotation.body && annotation.body.id) {
                                let imageUrl = annotation.body.id;
                                // const originalUrl = imageUrl;
                                
                                // Convert to full resolution for all IIIF libraries
                                if (imageUrl.includes('/full/')) {
                                    imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                }
                                pageLinks.push(imageUrl);
                                foundImages = true;
                            }
                        }
                    }
                }
            }
            
        }
        
        // Extract display name from IIIF manifest
        let displayName = 'IIIF Document';
        
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                displayName = manifest.label;
            } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                displayName = manifest.label.en[0];
            } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                displayName = manifest.label.none[0];
            } else if (typeof manifest.label === 'object') {
                // Try to extract any language variant
                const languages = Object.keys(manifest.label);
                if (languages.length > 0 && Array.isArray(manifest.label[languages[0]])) {
                    displayName = manifest.label[languages[0]][0];
                }
            }
        }
        
        // Fallback to metadata if no label found
        if (displayName === 'IIIF Document' && manifest.metadata) {
            const titleMetadata = manifest.metadata.find((m: any) => 
                m.label === 'Title' || 
                (typeof m.label === 'object' && (m.label.en?.[0] === 'Title' || m.label.none?.[0] === 'Title'))
            );
            if (titleMetadata?.value) {
                if (typeof titleMetadata.value === 'string') {
                    displayName = titleMetadata.value;
                } else if (Array.isArray(titleMetadata.value.en)) {
                    displayName = titleMetadata.value.en[0];
                } else if (Array.isArray(titleMetadata.value.none)) {
                    displayName = titleMetadata.value.none[0];
                }
            }
        }
        
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: displayName || 'IIIF Document',
            library: '' as any,
            originalUrl: ''
        };
    }

    async loadVatlibManifest(vatLibUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript name from URL
            const nameMatch = vatLibUrl.match(/\/view\/([^/?]+)/);
            if (!nameMatch) {
                throw new Error('Invalid Vatican Library URL format');
            }
            
            const manuscriptName = nameMatch[1];
            
            // Extract cleaner manuscript name according to patterns:
            // MSS_Vat.lat.7172 -> Vat.lat.7172
            // bav_pal_lat_243 -> Pal.lat.243
            // MSS_Reg.lat.15 -> Reg.lat.15
            let displayName = manuscriptName;
            if (manuscriptName.startsWith('MSS_')) {
                displayName = manuscriptName.substring(4);
            } else if (manuscriptName.startsWith('bav_')) {
                displayName = manuscriptName.substring(4).replace(/^([a-z])/, (match) => match.toUpperCase());
            }
            
            const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptName}/manifest.json`;
            
            const response = await this.fetchDirect(manifestUrl);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Manuscript not found: ${manuscriptName}. Please check the URL is correct.`);
                }
                throw new Error(`HTTP ${response.status}: Failed to load manifest`);
            }
            
            const iiifManifest = await response.json();
            
            // Check if manifest has the expected structure
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid manifest structure: missing sequences or canvases');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                
                // Vatican Library uses a service object with @id pointing to the image service
                if (resource.service && resource.service['@id']) {
                    // Extract the base service URL and construct full resolution image URL
                    const serviceId = resource.service['@id'];
                    return `${serviceId}/full/full/0/native.jpg`;
                }
                
                // Fallback to direct resource @id if no service (other IIIF implementations)
                if (resource['@id']) {
                    return resource['@id'];
                }
                
                return null;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'vatlib',
                displayName: displayName,
                originalUrl: vatLibUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Vatican Library manuscript: ${(error as Error).message}`);
        }
    }

    async loadDurhamManifest(url: string): Promise<ManuscriptManifest> {
        const manifestMatch = url.match(/[?&]manifest=([^&]+)/);
        if (!manifestMatch) {
            throw new Error('Invalid Durham URL format - could not extract manifest ID');
        }
        
        const manifestId = manifestMatch[1];
        
        // Durham University IIIF manifest URL pattern:
        // https://iiif.durham.ac.uk/manifests/trifle/32150/[first-2-chars]/[next-2-chars]/[next-2-chars]/[full-id]/manifest
        // Example: t1mp2676v52p -> t1/mp/26/t1mp2676v52p/manifest
        if (manifestId.length < 6) {
            throw new Error(`Invalid Durham manifest ID format: ${manifestId}`);
        }
        
        const part1 = manifestId.substring(0, 2);
        const part2 = manifestId.substring(2, 4);
        const part3 = manifestId.substring(4, 6);
        
        const manifestUrl = `https://iiif.durham.ac.uk/manifests/trifle/32150/${part1}/${part2}/${part3}/${manifestId}/manifest`;
        return this.loadIIIFManifest(manifestUrl);
    }

    async loadUgentManifest(url: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL pattern: https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C
            const manuscriptMatch = url.match(/\/viewer\/([^/?&]+)/);
            if (!manuscriptMatch) {
                throw new Error('Invalid UGent URL format. Expected format: https://lib.ugent.be/viewer/MANUSCRIPT_ID');
            }
            
            const manuscriptId = decodeURIComponent(manuscriptMatch[1]);
            
            // Construct the IIIF v3 manifest URL based on the pattern from the reference implementation
            const manifestUrl = `https://adore.ugent.be/IIIF/manifests/${manuscriptId}`;
            
            return this.loadIIIFManifest(manifestUrl);
        } catch (error: any) {
            throw new Error(`Failed to load UGent manifest: ${(error as Error).message}`);
        }
    }

    async loadBLManifest(url: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            
            // Check if this is a viewer URL or direct manifest URL
            if (url.includes('iiif.bl.uk/uv/') && url.includes('manifest=')) {
                // Extract manifest URL from viewer URL - handle URLs with tracking parameters
                const manifestMatch = url.match(/manifest=([^&\s]+)/);
                if (!manifestMatch) {
                    throw new Error('Invalid British Library viewer URL format. Expected format with manifest parameter');
                }
                manifestUrl = decodeURIComponent(manifestMatch[1]);
            } else if (url.includes('bl.digirati.io/iiif/')) {
                // Direct manifest URL - British Library doesn't need '/manifest' suffix
                manifestUrl = url;
            } else {
                // Fallback: try to extract ARK and use API
                const arkMatch = url.match(/ark:\/[^/]+\/[^/?\s]+/);
                if (arkMatch) {
                    manifestUrl = `https://api.bl.uk/metadata/iiif/${arkMatch[0]}/manifest.json`;
                } else {
                    throw new Error('Invalid British Library URL format');
                }
            }
            
            return this.loadIIIFManifest(manifestUrl);
        } catch (error: any) {
            throw new Error(`Failed to load British Library manifest: ${(error as Error).message}`);
        }
    }

    async loadUnifrManifest(url: string): Promise<ManuscriptManifest> {
        const pathMatch = url.match(/\/(?:en|de|fr|it)\/([^/]+)\/([^/]+)/) || url.match(/\/(?:thumbs|list\/one)\/([^/]+)\/([^/]+)/);
        const collection = pathMatch ? pathMatch[1] : '';
        const manuscript = pathMatch ? pathMatch[2] : '';
        if (!collection || !manuscript) {
            throw new Error('Invalid Unifr URL format - could not extract manifest ID');
        }
        const manifestId = `${collection}-${manuscript}`;
        const manifestUrl = `https://www.e-codices.unifr.ch/metadata/iiif/${manifestId}/manifest.json`;
        
        // Add proper headers for e-codices requests to avoid HTTP 400 errors
        const response = await this.fetchDirect(manifestUrl, {
            headers: {
                'Referer': url,
                'Accept': 'application/json,application/ld+json,*/*'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        let manifest;
        try {
            manifest = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        const pageLinks: string[] = [];
        const sequences = manifest.sequences || [manifest];
        
        for (const sequence of sequences) {
            const canvases = sequence.canvases || sequence.items || [];
            
            for (const canvas of canvases) {
                const images = canvas.images || canvas.items || [];
                
                for (const image of images) {
                    let imageUrl;
                    
                    if (image.resource) {
                        imageUrl = image.resource['@id'] || image.resource.id;
                    } else if (image.body) {
                        imageUrl = image.body.id;
                    }
                    
                    if (imageUrl) {
                        pageLinks.push(imageUrl);
                    }
                }
            }
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No page links found in IIIF manifest');
        }
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `UNIFR_${collection}_${manuscript}`,
            library: 'unifr',
            originalUrl: url
        };
    }

    async loadCeciliaManifest(url: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            let documentId: string;
            
            if (url.includes('api/viewer/lgiiif')) {
                // Direct manifest URL - extract document info and use as-is
                manifestUrl = url.replace('&max=260', ''); // Remove max parameter for full quality
                documentId = 'direct_manifest';
            } else {
                // Extract document ID from viewer URL
                // Example: https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=
                const idMatch = url.match(/\/viewer\/(\d+)/);
                if (!idMatch) {
                    throw new Error('Invalid Cecilia URL format - could not extract document ID');
                }
                
                documentId = idMatch[1];
            
                // For known documents, use direct manifest URLs
                if (documentId === '124') {
                    manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/99/72/0c/a5/99720ca5-de2c-43fc-a8b0-f7b27fedc24a/';
                } else if (documentId === '105') {
                    manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/18/d6/50/b5/18d650b5-14e5-4b48-88b1-6fa9b8982c7d/';
                } else {
                    // For unknown documents, try to extract manifest URL from viewer page HTML
                    const cleanViewerUrl = `https://cecilia.mediatheques.grand-albigeois.fr/viewer/${documentId}/`;
                    const viewerResp = await this.fetchDirect(cleanViewerUrl);
                    if (!viewerResp.ok) {
                        throw new Error(`Failed to load Cecilia viewer page: HTTP ${viewerResp.status}`);
                    }
                    const viewerPageHtml = await viewerResp.text();
                    
                    // Try lgiiif URL pattern: lgiiif?url=([^&'"]+)
                    const lgiiifMatch = viewerPageHtml.match(/lgiiif\?url=([^&'"]+)/);
                    if (lgiiifMatch) {
                        const encodedPath = lgiiifMatch[1];
                        manifestUrl = `https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=${encodedPath}`;
                    } else {
                        throw new Error(`Could not extract manifest URL from Cecilia viewer page for document ${documentId}`);
                    }
                }
            }
            
            
            // Load the IIIF-style manifest from Cecilia
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Cecilia manifest: HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            let manifestData;
            try {
                manifestData = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response from Cecilia manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
            }
            
            // Parse Cecilia's IIIF-style manifest format
            const pageLinks: string[] = [];
            
            if (manifestData.item && manifestData.item.tiles) {
                // Cecilia uses a tiles structure
                const tiles = manifestData.item.tiles;
                const imageIds = Object.keys(tiles);
                
                for (const id of imageIds) {
                    const tile = tiles[id];
                    if (tile['@id']) {
                        const imageUrl = `https://cecilia.mediatheques.grand-albigeois.fr${tile['@id']}/full/max/0/default.jpg`;
                        pageLinks.push(imageUrl);
                    }
                }
            } else {
                throw new Error('Invalid Cecilia manifest structure: missing item.tiles object');
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in Cecilia manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                displayName: `Cecilia_${documentId}`,
                library: 'cecilia',
                originalUrl: url
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Cecilia manifest: ${(error as Error).message}`);
        }
    }

    async loadIrhtManifest(url: string): Promise<ManuscriptManifest> {
        const arkMatch = url.match(/ark:\/(\d+)\/([^/?]+)/);
        if (!arkMatch) {
            throw new Error('Invalid IRHT URL format - could not extract ARK ID');
        }
        const [, authority, name] = arkMatch;
        
        // Add retry logic for server errors
        let lastError: Error = new Error('Unknown error');
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await this.fetchDirect(url, {}, attempt);
                
                if (response.status === 500) {
                    throw new Error(`IRHT server error (HTTP 500) - this appears to be a server-side issue with the IRHT digital archive. The manuscript may be temporarily unavailable. Please try again later or verify the URL: ${url}`);
                }
                
                if (!response.ok) {
                    throw new Error(`Failed to load IRHT page: HTTP ${response.status} - ${response.statusText}`);
                }
                
                const html = await response.text();
                
                // Enhanced IIIF pattern matching - try multiple patterns for robustness
                const patterns = [
                    // Original pattern for fully qualified URLs
                    /https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)\/full\/[^/\s"']+\/\d+\/default\.jpg/g,
                    // Broader pattern to catch partial URLs and extract image IDs
                    /https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g,
                    // Pattern specifically for src attributes
                    /src="https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g,
                    // Pattern for commented IIIF URLs
                    /<!-- a href="https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g
                ];
                
                let imageIds: string[] = [];
                for (const pattern of patterns) {
                    const matches = [...html.matchAll(pattern)];
                    const ids = matches.map((m) => m[1]);
                    imageIds.push(...ids);
                }
                
                // Remove duplicates and filter out invalid IDs
                imageIds = [...new Set(imageIds)].filter(id => id && id.length > 5);
                
                if (imageIds.length === 0) {
                    throw new Error(`No IIIF images found in IRHT page. The manuscript may not be digitized or may require authentication. URL: ${url}`);
                }
                
                const pageLinks = imageIds.map((id) =>
                    `https://iiif.irht.cnrs.fr/iiif/ark:/${authority}/${id}/full/max/0/default.jpg`,
                );
                
                console.log(`IRHT: Successfully extracted ${pageLinks.length} pages from ${url}`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    displayName: `IRHT_${name}`,
                    library: 'irht',
                    originalUrl: url
                };
                
            } catch (error: any) {
                lastError = error;
                
                // Only retry for server errors (5xx), not client errors (4xx)
                if ((error as Error).message.includes('500') && attempt < 3) {
                    console.warn(`IRHT attempt ${attempt} failed with server error, retrying in ${this.calculateRetryDelay(attempt)}ms...`);
                    await this.sleep(this.calculateRetryDelay(attempt));
                    continue;
                } else {
                    // Don't retry for client errors or final attempt
                    throw error;
                }
            }
        }
        
        throw new Error(`Failed to load IRHT manuscript after 3 attempts: ${lastError.message}`);
    }

    /**
     * Load Library of Congress manifest (IIIF v2.0)
     * Supports both item URLs and resource URLs
     */
    async loadLocManifest(locUrl: string): Promise<ManuscriptManifest> {
        const startTime = Date.now();
        this.logger.log({
            level: 'info',
            library: 'loc',
            url: locUrl,
            message: 'Starting LOC manifest load'
        });
        
        // Create progress monitor for LOC loading
        const progressMonitor = createProgressMonitor(
            'Library of Congress manifest loading',
            'loc',
            {
                initialTimeout: 60000,
                progressCheckInterval: 20000,
                maxTimeout: 360000
            }
        );
        
        const controller = progressMonitor.start();
        
        try {
            let manifestUrl = locUrl;
            
            console.log(`[loadLocManifest] Processing URL pattern...`);
            
            // Handle different LOC URL patterns
            if (locUrl.includes('/item/')) {
                // Extract item ID: https://www.loc.gov/item/2010414164/
                const itemMatch = locUrl.match(/\/item\/([^/?]+)/);
                if (itemMatch) {
                    manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
                    console.log(`[loadLocManifest] Transformed item URL to manifest: ${manifestUrl}`);
                    this.logger.log({
                        level: 'debug',
                        library: 'loc',
                        url: locUrl,
                        message: 'Transformed item URL to manifest URL',
                        details: { originalUrl: locUrl, manifestUrl }
                    });
                }
            } else if (locUrl.includes('/resource/')) {
                // Extract resource ID: https://www.loc.gov/resource/rbc0001.2022vollb14164/?st=gallery
                const resourceMatch = locUrl.match(/\/resource\/([^/?]+)/);
                if (resourceMatch) {
                    // Try to construct manifest URL from resource pattern
                    manifestUrl = `https://www.loc.gov/resource/${resourceMatch[1]}/manifest.json`;
                    console.log(`[loadLocManifest] Transformed resource URL to manifest: ${manifestUrl}`);
                    this.logger.log({
                        level: 'debug',
                        library: 'loc',
                        url: locUrl,
                        message: 'Transformed resource URL to manifest URL',
                        details: { originalUrl: locUrl, manifestUrl }
                    });
                }
            }
            
            progressMonitor.updateProgress(1, 10, 'Fetching manifest...');
            
            let displayName = 'Library of Congress Manuscript';
            
            console.log(`[loadLocManifest] Fetching manifest from: ${manifestUrl}`);
            const fetchStartTime = Date.now();
            
            // Load IIIF manifest
            const response = await this.fetchDirect(manifestUrl, {}, 0, controller.signal);
            
            const fetchElapsed = Date.now() - fetchStartTime;
            console.log(`[loadLocManifest] Manifest fetch completed - Status: ${response.status}, Time: ${fetchElapsed}ms`);
            
            if (!response.ok) {
                console.error(`[loadLocManifest] Failed to load manifest - HTTP ${response.status}: ${response.statusText}`);
                this.logger.log({
                    level: 'error',
                    library: 'loc',
                    url: manifestUrl,
                    message: `Failed to load manifest - HTTP ${response.status}`,
                    details: { status: response.status, statusText: response.statusText }
                });
                throw new Error(`Failed to load LOC manifest: HTTP ${response.status}`);
            }
            
            const manifest = await response.json();
            console.log(`[loadLocManifest] Manifest parsed successfully - Type: ${manifest['@type'] || 'unknown'}`);
            
            progressMonitor.updateProgress(3, 10, 'Parsing manifest...');
            
            // Extract title from IIIF v2.0 manifest
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (Array.isArray(manifest.label)) {
                    displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                }
            }
            
            // Extract page links from IIIF v2.0 structure
            const pageLinks: string[] = [];
            let totalPages = 0;
            
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                totalPages = canvases.length;
                
                console.log(`[loadLocManifest] Found ${totalPages} canvases in manifest`);
                progressMonitor.updateProgress(5, 10, `Processing ${totalPages} pages...`);
                
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        if (image.resource && image.resource.service && image.resource.service['@id']) {
                            // Use IIIF service for maximum resolution
                            // Testing showed full/full/0/default.jpg provides excellent quality (3+ MB per page)
                            const serviceId = image.resource.service['@id'];
                            const maxResUrl = `${serviceId}/full/full/0/default.jpg`;
                            pageLinks.push(maxResUrl);
                            
                            if (i === 0 || i === canvases.length - 1 || i % 10 === 0) {
                                console.log(`[loadLocManifest] Page ${i + 1}/${totalPages}: ${maxResUrl}`);
                            }
                        } else if (image.resource && image.resource['@id']) {
                            // Fallback to direct resource URL
                            pageLinks.push(image.resource['@id']);
                            console.log(`[loadLocManifest] Page ${i + 1} using fallback URL`);
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in LOC IIIF manifest');
            }
            
            const locManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'loc' as const,
                displayName,
                originalUrl: locUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(locUrl, locManifest).catch(console.warn);
            
            progressMonitor.complete();
            
            const totalElapsed = Date.now() - startTime;
            console.log(`[loadLocManifest] Successfully loaded manifest - Total pages: ${pageLinks.length}, Time: ${totalElapsed}ms`);
            console.log(`[loadLocManifest] Display name: ${displayName}`);
            
            this.logger.logManifestLoad('loc', locUrl, totalElapsed);
            this.logger.log({
                level: 'info',
                library: 'loc',
                url: locUrl,
                message: `Manifest loaded successfully with ${pageLinks.length} pages`,
                duration: totalElapsed,
                details: { totalPages: pageLinks.length, displayName }
            });
            
            return locManifest;
            
        } catch (error: any) {
            progressMonitor.abort();
            
            const elapsed = Date.now() - startTime;
            console.error(`[loadLocManifest] FAILED after ${elapsed}ms:`, error.message);
            console.error(`[loadLocManifest] Error details:`, {
                url: locUrl,
                manifestUrl: manifestUrl || 'not determined',
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            
            this.logger.logManifestLoad('loc', locUrl, elapsed, error);
            
            throw new Error(`Failed to load Library of Congress manuscript: ${(error as Error).message}`);
        }
    }

    async loadDijonManifest(url: string): Promise<ManuscriptManifest> {
        const msMatch = url.match(/img-viewer\/([^/?]+)/);
        if (!msMatch) {
            throw new Error('Invalid Dijon URL format - could not extract manuscript ID');
        }
        const manuscriptId = msMatch[1];
        const manifestUrl = `http://patrimoine.bm-dijon.fr/pleade/img-server/${manuscriptId}/dir.json`;
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load Dijon manifest: HTTP ${response.status}`);
        }
        const manifestData = await response.json();
        if (!Array.isArray(manifestData) || manifestData.length === 0) {
            throw new Error('No images found in Dijon manifest');
        }
        const pageLinks = manifestData.map((page: any) => {
            if (!page.versions || !Array.isArray(page.versions)) {
                throw new Error(`Invalid page versions for manuscript ${manuscriptId}`);
            }
            const version = page.versions.find((v: any) => v.src && !v.src.includes('__thumbs__'));
            if (!version || !version.src) {
                throw new Error(`No full-size version found for a page of manuscript ${manuscriptId}`);
            }
            return `http://patrimoine.bm-dijon.fr/pleade/img-server/${version.src}`;
        });
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `Dijon_${manuscriptId}`,
            library: 'dijon',
            originalUrl: url
        };
    }

    async loadLaonManifest(laonUrl: string): Promise<ManuscriptManifest> {
        // Extract document ID from viewer URL
        const idMatch = laonUrl.match(/\/viewer\/(\d+)/);
        if (!idMatch) {
            throw new Error('Invalid Laon URL format - could not extract document ID');
        }
        const documentId = idMatch[1];
        let manifestUrl;
        if (documentId === '1459') {
            // Known media path for document 1459
            manifestUrl = 'https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/a2/33/4a/b2/a2334ab2-0305-48a5-98aa-d3cdbeb87a97/';
        } else {
            // Fallback: extract manifest URL from viewer page
            const cleanViewerUrl = `https://bibliotheque-numerique.ville-laon.fr/viewer/${documentId}/`;
            const viewerResp = await this.fetchDirect(cleanViewerUrl);
            if (!viewerResp.ok) {
                throw new Error(`Failed to load Laon viewer page: HTTP ${viewerResp.status}`);
            }
            const html = await viewerResp.text();
            // Try lgiiif URL pattern
            const lgiiifMatch = html.match(/lgiiif\?url=([^&'"]+)/);
            if (lgiiifMatch) {
                manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=${lgiiifMatch[1]}`;
            } else {
                const mediaPathMatch = html.match(/["']\/medias\/([^"']+)["']/);
                if (!mediaPathMatch) {
                    throw new Error(`Could not extract manifest URL from Laon viewer page for document ${documentId}`);
                }
                manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/${mediaPathMatch[1]}/`;
            }
        }
        const resp = await this.fetchDirect(manifestUrl);
        if (!resp.ok) {
            throw new Error(`Failed to load Laon manifest: HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!data.item || !data.item.tiles || typeof data.item.tiles !== 'object') {
            throw new Error('Invalid Laon manifest structure: missing item.tiles object');
        }
        const tiles = data.item.tiles;
        const imageIds = Object.keys(tiles);
        if (imageIds.length === 0) {
            throw new Error('No images found in Laon manifest');
        }
        const pageLinks = imageIds.map((id) => {
            const tile = tiles[id];
            if (!tile['@id']) throw new Error(`Missing @id for image: ${id}`);
            return `https://bibliotheque-numerique.ville-laon.fr${tile['@id']}/full/full/0/default.jpg`;
        });
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `Laon_${documentId}`,
            library: 'laon',
            originalUrl: laonUrl
        };
    }

    async loadSharedCanvasManifest(url: string): Promise<ManuscriptManifest> {
        const match = url.match(/\/viewer\/mirador\/([^/?&]+)/);
        if (!match) {
            throw new Error('Invalid SharedCanvas URL format');
        }
        const manifestUrl = `https://sharedcanvas.be/IIIF/manifests/${match[1]}`;
        return this.loadIIIFManifest(manifestUrl);
    }

    /**
     * Load Saint-Omer Municipal Library manifest (IIIF v2.0)
     */
    async loadSaintOmerManifest(saintOmerUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL
            // URL format: https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/{MANUSCRIPT_ID}/?offset=...
            const urlMatch = saintOmerUrl.match(/\/viewer\/(\d+)/);
            if (!urlMatch) {
                throw new Error('Could not extract manuscript ID from Saint-Omer URL');
            }
            
            const manuscriptId = urlMatch[1];
            let displayName = `Saint-Omer Municipal Library - ${manuscriptId}`;
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/iiif/${manuscriptId}/manifest`;
            
            // Load IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: HTTP ${response.status}`);
            }
            
            const manifest = await response.json();
            
            // Extract metadata from IIIF v2.0 manifest
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (Array.isArray(manifest.label)) {
                    displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                }
            }
            
            // Get page count from sequences/canvases (IIIF v2.0)
            let totalPages = 0;
            const pageLinks: string[] = [];
            
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases && Array.isArray(sequence.canvases)) {
                    totalPages = sequence.canvases.length;
                    
                    // Extract image URLs with maximum resolution
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource['@id']) {
                                // Get the IIIF service URL and construct maximum resolution URL
                                let maxResUrl = image.resource['@id'];
                                
                                if (image.resource.service && image.resource.service['@id']) {
                                    const serviceId = image.resource.service['@id'];
                                    // Use Saint-Omer pattern: /full/max/0/default.jpg for maximum quality
                                    maxResUrl = `${serviceId}/full/max/0/default.jpg`;
                                } else {
                                    // Fallback: construct from resource URL if service not available
                                    const serviceBase = maxResUrl.split('/full/')[0];
                                    maxResUrl = `${serviceBase}/full/max/0/default.jpg`;
                                }
                                
                                pageLinks.push(maxResUrl);
                            }
                        }
                    }
                }
            }
            
            if (totalPages === 0 || pageLinks.length === 0) {
                throw new Error('No pages found in IIIF manifest');
            }
            
            const saintOmerManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'saint_omer' as const,
                displayName,
                originalUrl: saintOmerUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(saintOmerUrl, saintOmerManifest).catch(console.warn);
            
            return saintOmerManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Saint-Omer manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load University of Toronto manuscript manifest (IIIF v2.0/v3.0)
     * Supports both direct IIIF URLs and collections.library.utoronto.ca URLs
     */
    async loadTorontoManifest(torontoUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl = torontoUrl;
            let displayName = 'University of Toronto Manuscript';
            
            // Handle collections.library.utoronto.ca URLs
            if (torontoUrl.includes('collections.library.utoronto.ca')) {
                // Extract item ID from URL: https://collections.library.utoronto.ca/view/fisher2:F6521
                const viewMatch = torontoUrl.match(/\/view\/([^/]+)/);
                if (viewMatch) {
                    const itemId = viewMatch[1];
                    displayName = `University of Toronto - ${itemId}`;
                    
                    // Try different manifest URL patterns
                    const manifestPatterns = [
                        `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
                        `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
                        `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
                        `https://iiif.library.utoronto.ca/presentation/v3/${itemId.replace(':', '%3A')}/manifest`,
                        `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
                        `https://collections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
                        `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
                        `https://collections.library.utoronto.ca/api/iiif/${itemId.replace(':', '%3A')}/manifest`
                    ];
                    
                    let manifestFound = false;
                    for (const testUrl of manifestPatterns) {
                        try {
                            const response = await this.fetchDirect(testUrl);
                            if (response.ok) {
                                const content = await response.text();
                                if (content.includes('"@context"') && (content.includes('manifest') || content.includes('Manifest'))) {
                                    manifestUrl = testUrl;
                                    manifestFound = true;
                                    break;
                                }
                            }
                        } catch (error) {
                            // Continue trying other patterns
                        }
                    }
                    
                    if (!manifestFound) {
                        throw new Error(`No working manifest URL found for item ${itemId}`);
                    }
                } else {
                    throw new Error('Could not extract item ID from collections URL');
                }
            }
            
            // Handle direct IIIF URLs
            else if (torontoUrl.includes('iiif.library.utoronto.ca')) {
                if (!torontoUrl.includes('/manifest')) {
                    manifestUrl = torontoUrl.endsWith('/') ? `${torontoUrl}manifest` : `${torontoUrl}/manifest`;
                }
            }
            
            // Load IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: HTTP ${response.status}`);
            }
            
            const manifest = await response.json();
            
            // Extract metadata from IIIF manifest
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (Array.isArray(manifest.label)) {
                    displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                }
            }
            
            const pageLinks: string[] = [];
            
            // Handle IIIF v2 structure
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases && Array.isArray(sequence.canvases)) {
                    // Extract image URLs with maximum resolution
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource['@id']) {
                                let maxResUrl = image.resource['@id'];
                                
                                if (image.resource.service && image.resource.service['@id']) {
                                    const serviceId = image.resource.service['@id'];
                                    // Test different resolution parameters for maximum quality
                                    maxResUrl = `${serviceId}/full/max/0/default.jpg`;
                                } else {
                                    // Fallback: construct from resource URL if service not available
                                    const serviceBase = maxResUrl.split('/full/')[0];
                                    maxResUrl = `${serviceBase}/full/max/0/default.jpg`;
                                }
                                
                                pageLinks.push(maxResUrl);
                            }
                        }
                    }
                }
            }
            
            // Handle IIIF v3 structure
            else if (manifest.items && manifest.items.length > 0) {
                for (const item of manifest.items) {
                    if (item.items && item.items.length > 0) {
                        const annotationPage = item.items[0];
                        if (annotationPage.items && annotationPage.items.length > 0) {
                            const annotation = annotationPage.items[0];
                            if (annotation.body) {
                                let maxResUrl = annotation.body.id;
                                
                                if (annotation.body.service) {
                                    const service = Array.isArray(annotation.body.service) ? annotation.body.service[0] : annotation.body.service;
                                    if (service && service.id) {
                                        maxResUrl = `${service.id}/full/max/0/default.jpg`;
                                    }
                                }
                                
                                pageLinks.push(maxResUrl);
                            }
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in IIIF manifest');
            }
            
            const torontoManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'toronto' as const,
                displayName,
                originalUrl: torontoUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(torontoUrl, torontoManifest).catch(console.warn);
            
            return torontoManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load University of Toronto manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Download image with retries and proxy fallback
     */
    async downloadImageWithRetries(url: string, attempt = 0): Promise<ArrayBuffer> {
        const startTime = Date.now();
        const library = this.detectLibrary(url) as TLibrary;
        
        // Only log on first attempt to avoid duplicates with fetchDirect
        if (attempt === 0) {
            this.logger.log({
                level: 'info',
                library: library || 'unknown',
                url,
                message: `Starting image download`,
                attemptNumber: attempt + 1
            });
        }
        
        try {
            if (url.endsWith('.zif')) {
                return this.downloadAndProcessZifFile(url, attempt);
            }
            
            // Use proxy fallback for libraries with connection issues or when direct access fails
            // Note: Internet Culturale removed from proxy list to fix authentication issues
            // BDL added due to IIIF server instability (60% connection failures)
            // University of Graz removed from proxy list to use library-specific timeout multiplier (2.0x)
            const needsProxyFallback = url.includes('digitallibrary.unicatt.it') || 
                                     url.includes('mediatheques.orleans.fr') || 
                                     url.includes('aurelia.orleans.fr') || 
                                     url.includes('bdl.servizirl.it');
            
            this.logger.log({
                level: 'debug',
                library: library || 'unknown',
                url,
                message: `Proxy fallback needed: ${needsProxyFallback}`,
                details: { needsProxyFallback, attempt: attempt + 1 }
            });
            
            let response: Response;
            try {
                response = needsProxyFallback
                    ? await this.fetchWithProxyFallback(url)
                    : await this.fetchDirect(url, {}, attempt + 1); // Pass attempt number for timeout calculation
                
                // MDC Catalonia: If 1000px resolution fails, try full resolution fallback
                if (url.includes('mdc.csuc.cat') && !response.ok && url.includes('/full/1000,/')) {
                    console.log(`MDC Catalonia: 1000px resolution failed (${response.status}), trying full resolution fallback`);
                    const fallbackUrl = url.replace('/full/1000,/', '/full/full/');
                    response = needsProxyFallback
                        ? await this.fetchWithProxyFallback(fallbackUrl)
                        : await this.fetchDirect(fallbackUrl, {}, attempt + 1);
                }
            } catch (fetchError: any) {
                // Enhanced error handling for BNC Roma infrastructure failures
                if (url.includes('digitale.bnc.roma.sbn.it')) {
                    if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNRESET' || 
                        fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED' || 
                        fetchError.code === 'ETIMEDOUT' || fetchError.code === 'ENETUNREACH' ||
                        fetchError.message.includes('timeout') || fetchError.message.includes('ENETUNREACH')) {
                        throw new Error(`BNC Roma infrastructure failure: Cannot reach digitale.bnc.roma.sbn.it server. This appears to be a network infrastructure issue. Check www.bncrm.beniculturali.it for announcements or try again later.`);
                    }
                }
                
                // Enhanced error handling for MDC Catalonia network issues
                if (url.includes('mdc.csuc.cat')) {
                    const isNetworkError = fetchError.name === 'AbortError' || 
                                         fetchError.code === 'ECONNRESET' || 
                                         fetchError.code === 'ENOTFOUND' || 
                                         fetchError.code === 'ECONNREFUSED' || 
                                         fetchError.code === 'ETIMEDOUT' || 
                                         fetchError.code === 'ENETUNREACH' ||
                                         fetchError.message.includes('timeout') || 
                                         fetchError.message.includes('ECONNREFUSED') ||
                                         fetchError.message.includes('ENETUNREACH');
                    
                    if (isNetworkError) {
                        throw new Error(`MDC Catalonia network issue (attempt ${attempt}): Cannot reach mdc.csuc.cat servers. This appears to be a temporary connectivity issue. The server may be experiencing high load or network problems. Please try again later.`);
                    }
                }
                
                throw fetchError;
            }
            
            if (!response.ok) {
                this.logger.log({
                    level: 'error',
                    library: library || 'unknown',
                    url,
                    message: `HTTP error: ${response.status} ${response.statusText}`,
                    attemptNumber: attempt + 1,
                    details: { status: response.status, statusText: response.statusText }
                });
                
                // Enhanced error messages for BNC Roma HTTP errors
                if (url.includes('digitale.bnc.roma.sbn.it')) {
                    if (response.status === 500) {
                        throw new Error(`BNC Roma server error (HTTP 500): The image server is experiencing internal issues. This may be temporary - please try again.`);
                    } else if (response.status === 503) {
                        throw new Error(`BNC Roma service unavailable (HTTP 503): The image server is temporarily unavailable, possibly due to maintenance.`);
                    } else if (response.status === 404) {
                        throw new Error(`BNC Roma image not found (HTTP 404): The requested image may have been moved or the URL is incorrect.`);
                    } else if (response.status >= 500) {
                        throw new Error(`BNC Roma server error (HTTP ${response.status}): The image server is experiencing technical difficulties.`);
                    }
                }
                
                // Enhanced error messages for MDC Catalonia HTTP errors
                if (url.includes('mdc.csuc.cat')) {
                    if (response.status === 500) {
                        throw new Error(`MDC Catalonia server error (HTTP 500): The mdc.csuc.cat image server is experiencing internal issues. This may be temporary - please try again.`);
                    } else if (response.status === 503) {
                        throw new Error(`MDC Catalonia service unavailable (HTTP 503): The image server is temporarily unavailable, possibly due to maintenance.`);
                    } else if (response.status === 404) {
                        throw new Error(`MDC Catalonia image not found (HTTP 404): The requested image may have been moved or the URL structure has changed. Please verify the manuscript ID and page number.`);
                    } else if (response.status === 403) {
                        throw new Error(`MDC Catalonia access denied (HTTP 403): The image server is blocking this request. This may require authentication or the manuscript may have access restrictions.`);
                    } else if (response.status === 501) {
                        throw new Error(`MDC Catalonia resolution not supported (HTTP 501): The requested image resolution is not supported. Try a different resolution (full/full, full/max, full/800,).`);
                    } else if (response.status >= 500) {
                        throw new Error(`MDC Catalonia server error (HTTP ${response.status}): The mdc.csuc.cat server is experiencing technical difficulties.`);
                    }
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            const elapsed = Date.now() - startTime;
            
            this.logger.log({
                level: 'info',
                library: library || 'unknown',
                url,
                message: `Buffer downloaded - Size: ${buffer.byteLength} bytes, Time: ${elapsed}ms`,
                duration: elapsed,
                details: { size: buffer.byteLength, speedMbps: (buffer.byteLength / elapsed / 1024).toFixed(2) }
            });
            
            if (buffer.byteLength < MIN_VALID_IMAGE_SIZE_BYTES) {
                this.logger.log({
                    level: 'error',
                    library: library || 'unknown',
                    url,
                    message: `Image too small: ${buffer.byteLength} bytes (min: ${MIN_VALID_IMAGE_SIZE_BYTES})`,
                    details: { size: buffer.byteLength, minSize: MIN_VALID_IMAGE_SIZE_BYTES }
                });
                throw new Error(`Image too small: ${buffer.byteLength} bytes`);
            }
            
            // Special validation for Internet Culturale to detect authentication error pages
            if (url.includes('internetculturale.it')) {
                await this.validateInternetCulturaleImage(buffer, url);
            }
            
            return buffer;
            
        } catch (error: any) {
            const elapsed = Date.now() - startTime;
            this.logger.logDownloadError(library || 'unknown', url, error, attempt + 1);
            console.error(`[downloadImageWithRetries] Error after ${elapsed}ms:`, error.message);
            
            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                // BDL Quality Fallback: Try lower quality before retrying same quality
                if (url.includes('bdl.servizirl.it') && (url.includes('/full/max/') || url.includes('/full/full/'))) {
                    const qualityFallbacks = ['/full/2048,/', '/full/1024,/', '/full/512,/'];
                    const currentQuality = (url.includes('/full/max/') || url.includes('/full/full/')) ? 0 : 
                                         url.includes('/full/2048,') ? 1 : 
                                         url.includes('/full/1024,') ? 2 : 3;
                    
                    if (currentQuality < qualityFallbacks.length) {
                        const fallbackUrl = url.replace(/\/full\/[^/]+\//, qualityFallbacks[currentQuality]);
                        console.log(`BDL quality fallback: ${url} -> ${fallbackUrl}`);
                        return this.downloadImageWithRetries(fallbackUrl, attempt);
                    }
                }
                
                // Check if library supports progressive backoff
                const library = this.detectLibrary(url) as TLibrary;
                const useProgressiveBackoff = library && 
                    LibraryOptimizationService.getOptimizationsForLibrary(library).enableProgressiveBackoff;
                    
                const delay = useProgressiveBackoff 
                    ? LibraryOptimizationService.calculateProgressiveBackoff(attempt + 1)
                    : this.calculateRetryDelay(attempt);
                
                this.logger.logRetry(library || 'unknown', url, attempt + 2, delay);
                console.log(`[downloadImageWithRetries] Will retry - Library: ${library}, Progressive backoff: ${useProgressiveBackoff}, Delay: ${delay}ms`);
                console.log(`Retrying ${url} (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms delay` + 
                           (useProgressiveBackoff ? ' (progressive backoff)' : ''));
                
                await this.sleep(delay);
                return this.downloadImageWithRetries(url, attempt + 1);
            }
            
            const totalTime = Date.now() - startTime;
            this.logger.log({
                level: 'error',
                library: library || 'unknown',
                url,
                message: `FINAL FAILURE after ${maxRetries + 1} attempts`,
                attemptNumber: maxRetries + 1,
                duration: totalTime,
                errorStack: error.stack
            });
            console.error(`[downloadImageWithRetries] FINAL FAILURE after ${maxRetries + 1} attempts for ${url}`);
            console.error(`[downloadImageWithRetries] Total time spent: ${totalTime}ms`);
            
            // Enhanced error message for BNC Roma failures
            if (url.includes('digitale.bnc.roma.sbn.it')) {
                if ((error as Error).message.includes('BNC Roma infrastructure failure')) {
                    throw new Error(`BNC Roma complete failure: Server infrastructure is completely unreachable after ${maxRetries} attempts with progressive backoff. The digital library server appears to be offline. Check www.bncrm.beniculturali.it for service announcements or contact GARR support at cert@garr.it`);
                } else if ((error as Error).message.includes('BNC Roma server error')) {
                    throw new Error(`BNC Roma persistent server errors: Multiple server errors encountered after ${maxRetries} attempts. The digital library may be experiencing technical difficulties. Please try again later or contact BNC Roma support.`);
                }
            }
            
            throw new Error(`Failed after ${maxRetries} attempts: ${(error as Error).message}`);
        }
    }

    async downloadAndProcessZifFile(url: string, attempt = 0): Promise<ArrayBuffer> {
        // Calculate timeout based on attempt number (more time for retries)
        const baseTimeout = 300000; // 5 minutes base
        const timeoutMs = baseTimeout + (attempt * 120000); // +2 minutes per retry
        
        try {
            console.log(`Processing ZIF file: ${url} (attempt ${attempt + 1})`);
            
            // Use the dedicated ZIF processor with timeout protection
            const representativeImageBuffer = await this.zifProcessor.processZifFile(url);
            
            console.log(`ZIF processed successfully: ${(representativeImageBuffer.length / 1024 / 1024).toFixed(2)} MB high-quality image`);
            
            // Convert Buffer to ArrayBuffer for compatibility
            const arrayBuffer = new ArrayBuffer(representativeImageBuffer.length);
            const view = new Uint8Array(arrayBuffer);
            view.set(representativeImageBuffer);
            
            return arrayBuffer;
            
        } catch (error: any) {
            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                const isTimeoutError = (error as Error).message.includes('timeout') || (error as Error).message.includes('timed out');
                const delay = isTimeoutError ? this.calculateRetryDelay(attempt) * 2 : this.calculateRetryDelay(attempt);
                
                console.log(`ZIF processing failed (attempt ${attempt + 1}/${maxRetries}): ${(error as Error).message}${isTimeoutError ? ' [TIMEOUT]' : ''}`);
                console.log(`Retrying ZIF processing in ${delay / 1000}s with ${timeoutMs / 1000}s timeout...`);
                
                await this.sleep(delay);
                return this.downloadAndProcessZifFile(url, attempt + 1);
            }
            
            // Provide more specific error message for timeout issues
            if ((error as Error).message.includes('timeout') || (error as Error).message.includes('timed out')) {
                throw new Error(`ZIF processing timed out after ${maxRetries + 1} attempts. This manuscript may be very large or the server may be overloaded. Please try again later.`);
            }
            
            throw new Error(`Failed to process ZIF file after ${maxRetries + 1} attempts: ${(error as Error).message}`);
        }
    }


    /**
     * Download manuscript
     */
    async downloadManuscript(url: string, options: any = {}): Promise<any> {
        const {
            onProgress = () => {},
            onManifestLoaded = () => {},
            maxConcurrent = configService.get('maxConcurrentDownloads'),
            skipExisting = false,
            startPage,
            endPage,
        } = options;

        const downloadStartTime = Date.now();
        let manifest: ManuscriptManifest | undefined;
        let filepath: string | undefined;
        
        try {
            // Load manifest
            const manifestStartTime = Date.now();
            manifest = await this.loadManifest(url);
            const manifestLoadDuration = Date.now() - manifestStartTime;
            
            // Log manifest loading completion
            const usingCachedManifest = await this.manifestCache.get(url) !== null;
            this.logger.log({
                level: 'info',
                library: manifest.library || 'unknown',
                url,
                message: `Manifest loaded: ${manifest.totalPages} pages found${usingCachedManifest ? ' (from cache)' : ''}`,
                duration: manifestLoadDuration,
                details: {
                    totalPages: manifest.totalPages,
                    cached: usingCachedManifest,
                    displayName: manifest.displayName
                }
            });
            
            onManifestLoaded(manifest);
            
            // Get internal cache directory for temporary images
            const tempImagesDir = path.join(app.getPath('userData'), 'temp-images');
            
            // Ensure temporary images directory exists
            await fs.mkdir(tempImagesDir, { recursive: true });
            
            // Generate filename using filesystem-safe sanitization
            const sanitizedName = manifest.displayName
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove filesystem-unsafe and control characters
                .replace(/[\u00A0-\u9999]/g, '_')         // Replace Unicode special characters that may cause Windows issues
                .replace(/[^\w\s.-]/g, '_')               // Replace any remaining special characters except word chars, spaces, dots, hyphens
                .replace(/\s+/g, '_')                     // Replace spaces with underscores
                .replace(/_{2,}/g, '_')                   // Replace multiple underscores with single underscore
                .replace(/^_|_$/g, '')                    // Remove leading/trailing underscores
                .replace(/\.+$/g, '')                     // Remove trailing periods (Windows compatibility)
                .substring(0, 100) || 'manuscript';       // Limit to 100 characters with fallback
            
            // Calculate pages to download for splitting logic
            // Fix for Manuscripta.at: Use startPageFromUrl from manifest if user didn't specify startPage
            const actualStartPage = Math.max(1, startPage || manifest.startPageFromUrl || 1);
            const actualEndPage = Math.min(manifest.totalPages, endPage || manifest.totalPages);
            const totalPagesToDownload = actualEndPage - actualStartPage + 1;
            
            // Determine if we need to split the PDF (like barsky.club)
            const shouldSplit = totalPagesToDownload > 1000;
            const maxPagesPerPart = 250;
            
            let filename: string;
            let filepath: string;
            
            // Final PDF goes to Downloads folder - always create a subfolder for each manuscript
            const downloadsDir = app.getPath('downloads');
            await fs.mkdir(downloadsDir, { recursive: true });
            
            // Always create a subfolder with the manuscript name
            const targetDir = path.join(downloadsDir, sanitizedName);
            await fs.mkdir(targetDir, { recursive: true });
            
            if (shouldSplit) {
                const partNumber = String(1).padStart(2, '0');
                filename = `${sanitizedName}_part_${partNumber}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(targetDir, filename);
            } else {
                // Always include page numbers for clarity
                filename = `${sanitizedName}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(targetDir, filename);
            }
            
            // Check if file exists
            if (skipExisting) {
                try {
                    await fs.access(filepath);
                    return { success: true, filepath, skipped: true };
                } catch {
                    // File doesn't exist, continue with download
                }
            }
            
            // Page range already calculated above for filename generation
            
            
            const imagePaths: string[] = [];
            const failedPages: number[] = [];
            const writePromises: Promise<void>[] = [];
            const startTime = Date.now();
            let completedPages = 0;
            
            const updateProgress = () => {
                const progress = completedPages / totalPagesToDownload;
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = completedPages / elapsed;
                const eta = rate > 0 ? (totalPagesToDownload - completedPages) / rate : 0;
                onProgress({ 
                    progress, 
                    completedPages, 
                    totalPages: totalPagesToDownload, 
                    eta: this.formatETA(eta) 
                });
            };
            
            // Apply library-specific optimization settings for concurrent downloads
            const globalMaxConcurrent = maxConcurrent || configService.get('maxConcurrentDownloads');
            const library = manifest.library as TLibrary;
            const autoSplitThresholdMB = Math.round(configService.get('autoSplitThreshold') / (1024 * 1024)); // Convert bytes to MB
            const optimizations = LibraryOptimizationService.applyOptimizations(
                autoSplitThresholdMB,
                globalMaxConcurrent,
                library
            );
            const actualMaxConcurrent = optimizations.maxConcurrentDownloads;
            
            // Log optimization info for debugging
            if (optimizations.optimizationDescription) {
                console.log(`Applying ${library} optimizations: ${optimizations.optimizationDescription}`);
                console.log(`Using ${actualMaxConcurrent} concurrent downloads (global: ${globalMaxConcurrent})`);
            }
            const semaphore = new Array(actualMaxConcurrent).fill(null);
            let nextPageIndex = actualStartPage - 1; // Convert to 0-based index
            
            const downloadPage = async (pageIndex: number) => {
                let imageUrl = manifest.pageLinks[pageIndex];
                
                // Skip placeholder URLs (empty strings) used for missing pages
                if (!imageUrl || imageUrl === '') {
                    console.warn(`Skipping missing page ${pageIndex + 1}`);
                    completedPages++;
                    updateProgress();
                    return;
                }
                
                // Check if this is a tile-based system
                const isTileBased = await this.tileEngineService.isTileBasedUrl(imageUrl);
                if (isTileBased) {
                    const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                    const imgPath = path.join(tempImagesDir, imgFile);
                    
                    try {
                        // Skip if already downloaded
                        await fs.access(imgPath);
                        imagePaths[pageIndex] = imgPath;
                        completedPages++;
                        updateProgress();
                        return;
                    } catch {
                        // Not present: download using tile engine
                        try {
                            console.log(`Downloading tile-based page ${pageIndex + 1} from ${imageUrl}`);
                            
                            const tileCallbacks = this.tileEngineService.createProgressCallback(
                                (progress) => {
                                    // Update progress with tile download info
                                    const tileProgress = completedPages + (progress.percentage / 100);
                                    const elapsed = (Date.now() - startTime) / 1000;
                                    const rate = tileProgress / elapsed;
                                    const eta = rate > 0 ? (totalPagesToDownload - tileProgress) / rate : 0;
                                    
                                    onProgress({ 
                                        progress: tileProgress / totalPagesToDownload, 
                                        completedPages: Math.floor(tileProgress), 
                                        totalPages: totalPagesToDownload, 
                                        eta: this.formatETA(eta) 
                                    });
                                },
                                (status) => {
                                    console.log(`Tile download status: ${status.phase} - ${status.message}`);
                                }
                            );
                            
                            const result = await this.tileEngineService.downloadTilesAndStitch(
                                imageUrl,
                                imgPath,
                                tileCallbacks
                            );
                            
                            if (result.success) {
                                imagePaths[pageIndex] = imgPath;
                                completedPages++;
                                console.log(`Successfully downloaded ${result.downloadedTiles} tiles for page ${pageIndex + 1}`);
                            } else {
                                console.error(`Failed to download tiles for page ${pageIndex + 1}: ${result.errors.join(', ')}`);
                                failedPages.push(pageIndex + 1);
                            }
                        } catch (error: any) {
                            console.error(`Tile download error for page ${pageIndex + 1}: ${error.message}`);
                            failedPages.push(pageIndex + 1);
                        }
                    }
                    
                    updateProgress();
                    return;
                }
                
                // Handle lazy-loaded Florus pages
                if (imageUrl.startsWith('FLORUS_LAZY:')) {
                    const parts = imageUrl.split(':');
                    const cote = parts[1];
                    const pageNum = parseInt(parts[2]);
                    const basePath = parts.slice(3).join(':'); // Rejoin in case basePath contains colons
                    console.log(`Fetching lazy-loaded page ${pageNum} for ${cote}`);
                    
                    try {
                        const pageUrl = `https://florus.bm-lyon.fr/visualisation.php?cote=${cote}&vue=${pageNum}`;
                        const pageResponse = await this.fetchDirect(pageUrl);
                        
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                                  pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                                  pageHtml.match(/image\s*:\s*"([^"]+)"/);
                            
                            if (pageImageMatch) {
                                const imagePath = pageImageMatch[1];
                                const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
                                const fullImagePath = `${basePath}${filename}`;
                                imageUrl = `https://florus.bm-lyon.fr/fcgi-bin/iipsrv.fcgi?FIF=${fullImagePath}&WID=2000&CVT=JPEG`;
                            } else {
                                console.warn(`No image found for lazy-loaded page ${pageNum}`);
                                completedPages++;
                                updateProgress();
                                return;
                            }
                        } else {
                            console.warn(`Failed to fetch lazy page ${pageNum}: HTTP ${pageResponse.status}`);
                            completedPages++;
                            updateProgress();
                            return;
                        }
                    } catch (error: any) {
                        console.error(`Failed to fetch lazy page ${pageNum}: ${(error as Error).message}`);
                        completedPages++;
                        updateProgress();
                        return;
                    }
                }
                
                const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                const imgPath = path.join(tempImagesDir, imgFile);
                
                try {
                    // Skip if already downloaded
                    await fs.access(imgPath);
                    // Mark path for skipped file
                    imagePaths[pageIndex] = imgPath;
                    completedPages++; // Count cached files as completed
                } catch {
                    // Not present: fetch and write
                    try {
                        const imageData = await this.downloadImageWithRetries(imageUrl);
                        const writePromise = fs.writeFile(imgPath, Buffer.from(imageData));
                        writePromises.push(writePromise);
                        // Only mark path if download succeeded
                        imagePaths[pageIndex] = imgPath;
                        completedPages++; // Only increment on successful download
                    } catch (error: any) {
                        console.error(`\n❌ Failed to download page ${pageIndex + 1}: ${(error as Error).message}`);
                        // Track failed page
                        failedPages.push(pageIndex + 1);
                        // Don't mark path for failed downloads
                        // Don't increment completedPages for failures
                    }
                }
                updateProgress();
            };
            
            await Promise.all(semaphore.map(async () => {
                while (nextPageIndex < actualEndPage) {
                    const idx = nextPageIndex++;
                    await downloadPage(idx);
                }
            }));
            
            // Wait for all file writes to complete before processing
            await Promise.all(writePromises);
            
            // Ensure final progress update
            onProgress({ 
                progress: 1.0, 
                completedPages: totalPagesToDownload, 
                totalPages: totalPagesToDownload, 
                eta: '0s' 
            });
            
            // Create complete array with placeholders for failed pages - only for the requested page range
            const completeImagePaths: (string | null)[] = [];
            for (let i = 0; i < totalPagesToDownload; i++) {
                const actualPageIndex = actualStartPage - 1 + i; // Convert to 0-based index
                completeImagePaths[i] = imagePaths[actualPageIndex] || null;
            }
            
            const validImagePaths = imagePaths.filter(Boolean);
            
            if (validImagePaths.length === 0) {
                throw new Error('No images were successfully downloaded');
            }
            
            // Enhanced validation for manuscripta.se to prevent infinite loops
            if (manifest.library === 'manuscripta') {
                const successRate = validImagePaths.length / totalPagesToDownload;
                const minSuccessRate = 0.8; // At least 80% success rate required
                
                if (successRate < minSuccessRate) {
                    throw new Error(`Manuscripta.se download had low success rate: ${Math.round(successRate * 100)}% (${validImagePaths.length}/${totalPagesToDownload} pages). Minimum ${Math.round(minSuccessRate * 100)}% required to prevent infinite loops.`);
                }
                
                console.log(`✅ Manuscripta.se validation passed: ${Math.round(successRate * 100)}% success rate (${validImagePaths.length}/${totalPagesToDownload} pages)`);
            }
            
            validImagePaths.sort((a, b) => {
                const aNum = parseInt(a.match(/_page_(\d+)\.jpg$/)![1], 10);
                const bNum = parseInt(b.match(/_page_(\d+)\.jpg$/)![1], 10);
                return aNum - bNum;
            });
            
            // Log PDF creation start
            this.logger.logPdfCreationStart(
                manifest.library || 'unknown',
                completeImagePaths.length,
                targetDir
            );
            
            if (shouldSplit) {
                // Split into multiple PDFs like barsky.club
                const totalParts = Math.ceil(completeImagePaths.length / maxPagesPerPart);
                const createdFiles: string[] = [];
                
                for (let partIndex = 0; partIndex < totalParts; partIndex++) {
                    const startIdx = partIndex * maxPagesPerPart;
                    const endIdx = Math.min(startIdx + maxPagesPerPart, completeImagePaths.length);
                    const partImages = completeImagePaths.slice(startIdx, endIdx);
                    
                    const partNumber = String(partIndex + 1).padStart(2, '0');
                    const partFilename = `${sanitizedName}_part_${partNumber}.pdf`;
                    const partFilepath = path.join(targetDir, partFilename);
                    
                    const partStartPage = actualStartPage + startIdx;
                    try {
                        await this.convertImagesToPDFWithBlanks(partImages, partFilepath, partStartPage, manifest);
                        createdFiles.push(partFilepath);
                    } catch (pdfError: any) {
                        console.error(`Failed to create PDF part ${partNumber}: ${pdfError.message}`);
                        this.logger.logPdfCreationError(manifest.library || 'unknown', pdfError, {
                            partNumber,
                            imagesInPart: partImages.length,
                            outputPath: partFilepath
                        });
                        throw new Error(`PDF creation failed for part ${partNumber}: ${pdfError.message}`);
                    }
                }
                
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {
                        // Ignore file deletion errors
                    }
                }
                
                // Log manuscript download complete with all files
                const downloadDuration = Date.now() - downloadStartTime;
                this.logger.logManuscriptDownloadComplete(
                    manifest.library || 'unknown',
                    url,
                    validImagePaths.length,
                    createdFiles,
                    downloadDuration
                );
                
                return { 
                    success: true, 
                    filepath: createdFiles[0], // Return first part as primary
                    splitFiles: createdFiles,
                    totalPages: validImagePaths.length, 
                    failedPages: manifest.totalPages - validImagePaths.length,
                    partsCreated: totalParts
                };
            } else {
                // Single PDF
                try {
                    await this.convertImagesToPDFWithBlanks(completeImagePaths, filepath, actualStartPage, manifest);
                } catch (pdfError: any) {
                    console.error(`Failed to create PDF: ${pdfError.message}`);
                    this.logger.logPdfCreationError(manifest.library || 'unknown', pdfError, {
                        totalImages: completeImagePaths.length,
                        outputPath: filepath
                    });
                    throw new Error(`PDF creation failed: ${pdfError.message}`);
                }
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {
                        // Ignore file deletion errors
                    }
                }
                
                const failedPagesCount = failedPages.length;
                const statusMessage = failedPagesCount > 0 
                    ? `${failedPagesCount} of ${manifest.totalPages} pages couldn't be downloaded`
                    : undefined;
                
                // Log manuscript download complete
                const downloadDuration = Date.now() - downloadStartTime;
                this.logger.logManuscriptDownloadComplete(
                    manifest.library || 'unknown',
                    url,
                    manifest.totalPages,
                    [filepath],
                    downloadDuration
                );
                
                return { 
                    success: true, 
                    filepath, 
                    totalPages: manifest.totalPages, // Total pages including blanks
                    failedPages: failedPagesCount,
                    statusMessage 
                };
            }
            
        } catch (error: any) {
            console.error(`❌ Download failed: ${(error as Error).message}`);
            
            // Log manuscript download failed with better stage detection
            let failedStage = 'unknown';
            if (!manifest) {
                failedStage = 'manifest_loading';
            } else if (error.message?.includes('convertImagesToPDF') || 
                      error.message?.includes('PDF') || 
                      error.message?.includes('memory') ||
                      error.message?.includes('No pages created') ||
                      validImagePaths && validImagePaths.length > 0 && !filepath) {
                failedStage = 'pdf_creation';
            } else if (validImagePaths && validImagePaths.length === 0) {
                failedStage = 'image_download';
            } else {
                failedStage = 'processing';
            }
            
            this.logger.logManuscriptDownloadFailed(
                manifest?.library || this.detectLibrary(url) || 'unknown',
                url,
                error as Error,
                failedStage
            );
            
            throw error;
        }
    }

    /**
     * Convert images to PDF with robust error handling and memory management
     */
    async convertImagesToPDF(imagePaths: string[], outputPath: string, manifest?: any): Promise<void> {
        const startTime = Date.now();
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024; // 1GB memory limit
        
        // Log PDF conversion start
        this.logger.log({
            level: 'info',
            library: manifest?.library || 'unknown',
            message: `Starting PDF conversion with ${totalImages} images`,
            details: { totalImages, outputPath }
        });
        
        // Special handling for large manuscripta.se files to prevent infinite loops
        let batchSize;
        if (manifest?.library === 'manuscripta' && totalImages > 300) {
            batchSize = 8; // Very small batches for 300+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using very small batch size: ${batchSize}`);
        } else if (manifest?.library === 'manuscripta' && totalImages > 200) {
            batchSize = 12; // Small batches for 200+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using small batch size: ${batchSize}`);
        } else if (manifest?.library === 'manuscripta' && totalImages > 100) {
            batchSize = 20;
        } else {
            batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20))); // Adaptive batch size
        }
        
        const allPdfBytes: Uint8Array[] = [];
        let processedCount = 0;
        
        // Process images in batches to manage memory
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
            const batchNum = Math.floor(i / batchSize) + 1;
            // const totalBatches = Math.ceil(totalImages / batchSize);
            
            try {
                const batchPdfDoc = await PDFDocument.create();
                let validImagesInBatch = 0;
                
                for (const imagePath of batch) {
                    try {
                        // Check if file exists and is accessible
                        await fs.access(imagePath);
                        const stats = await fs.stat(imagePath);
                        
                        if (stats.size < MIN_VALID_IMAGE_SIZE_BYTES) {
                            continue;
                        }
                        
                        // Read original image without any processing
                        const imageBuffer = await fs.readFile(imagePath);
                        
                        // Embed image in PDF
                        let image;
                        try {
                            // Try as JPEG first
                            image = await batchPdfDoc.embedJpg(imageBuffer);
                        } catch {
                            try {
                                // Fallback to PNG
                                image = await batchPdfDoc.embedPng(imageBuffer);
                            } catch (embedError: any) {
                                continue;
                            }
                        }
                        
                        // Add page with original image dimensions
                        const { width, height } = image;
                        
                        const page = batchPdfDoc.addPage([width, height]);
                        page.drawImage(image, {
                            x: 0,
                            y: 0,
                            width,
                            height,
                        });
                        
                        validImagesInBatch++;
                        processedCount++;
                        
                    } catch (error: any) {
                        console.error(`\n❌ Failed to process ${path.basename(imagePath)}: ${(error as Error).message}`);
                        continue;
                    }
                }
                
                if (validImagesInBatch > 0) {
                    // Save batch PDF
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);
                    
                    // Force garbage collection after each batch if available
                    if (global.gc) {
                        global.gc();
                        // For large manuscripta.se files, add extra memory cleanup time
                        if (manifest?.library === 'manuscripta' && totalImages > 200) {
                            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
                            console.log(`Memory cleanup completed after batch ${batchNum}/${Math.ceil(totalImages / batchSize)}`);
                        }
                    }
                }
                
            } catch (batchError: any) {
                console.error(`\n❌ Batch ${batchNum} failed: ${batchError.message}`);
                throw batchError;
            }
        }
        
        if (allPdfBytes.length === 0) {
            throw new Error('No valid images were processed into PDF');
        }
        
        // Merge all batch PDFs into final PDF
        
        if (allPdfBytes.length === 1) {
            // Single batch, just write it
            await this.writeFileWithVerification(outputPath, Buffer.from(allPdfBytes[0]));
        } else {
            // Multiple batches, merge them
            const finalPdfDoc = await PDFDocument.create();
            
            for (let i = 0; i < allPdfBytes.length; i++) {
                try {
                    const batchPdf = await PDFDocument.load(allPdfBytes[i]);
                    const pageIndices = batchPdf.getPageIndices();
                    const copiedPages = await finalPdfDoc.copyPages(batchPdf, pageIndices);
                    
                    copiedPages.forEach((page) => finalPdfDoc.addPage(page));
                } catch (mergeError: any) {
                    console.error(`\n❌ Failed to merge batch ${i + 1}: ${mergeError.message}`);
                    throw mergeError;
                }
            }
            
            const finalPdfBytes = await finalPdfDoc.save();
            await this.writeFileWithVerification(outputPath, Buffer.from(finalPdfBytes));
            
            // Log PDF creation complete
            const duration = Date.now() - startTime;
            const stats = await fs.stat(outputPath);
            this.logger.logPdfCreationComplete(
                manifest?.library || 'unknown',
                outputPath,
                stats.size,
                duration
            );
        }
        
    }

    async convertImagesToPDFWithBlanks(imagePaths: (string | null)[], outputPath: string, startPageNumber: number = 1, manifest?: any): Promise<void> {
        const startTime = Date.now();
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024;
        
        // Log PDF conversion start
        this.logger.log({
            level: 'info',
            library: manifest?.library || 'unknown',
            message: `Starting PDF conversion with ${totalImages} images (with blanks for failed pages)`,
            details: { totalImages, outputPath, startPageNumber }
        });
        
        // Special handling for large manuscripta.se files to prevent infinite loops
        let batchSize;
        if (manifest?.library === 'manuscripta' && totalImages > 300) {
            batchSize = 8; // Very small batches for 300+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using very small batch size: ${batchSize}`);
        } else if (manifest?.library === 'manuscripta' && totalImages > 200) {
            batchSize = 12; // Small batches for 200+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using small batch size: ${batchSize}`);
        } else if (manifest?.library === 'manuscripta' && totalImages > 100) {
            batchSize = 20;
        } else {
            batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20)));
        }
        
        const allPdfBytes: Uint8Array[] = [];
        let processedCount = 0;
        
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
            
            try {
                const batchPdfDoc = await PDFDocument.create();
                let pagesInBatch = 0;
                
                for (let j = 0; j < batch.length; j++) {
                    const imagePath = batch[j];
                    const pageNumber = startPageNumber + i + j;
                    
                    if (imagePath === null) {
                        // Create informative page for missing image
                        const page = batchPdfDoc.addPage([595, 842]); // A4 size
                        const { height } = page.getSize();
                        
                        page.drawText(`Page ${pageNumber} - Download Failed`, {
                            x: 50,
                            y: height - 100,
                            size: 18,
                            color: rgb(0.6, 0.2, 0.2),
                        });
                        
                        page.drawText('This page could not be downloaded after multiple attempts.', {
                            x: 50,
                            y: height - 140,
                            size: 12,
                            color: rgb(0.4, 0.4, 0.4),
                        });
                        
                        page.drawText('Possible causes:', {
                            x: 50,
                            y: height - 170,
                            size: 11,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Server temporarily unavailable', {
                            x: 70,
                            y: height - 190,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Network connectivity issues', {
                            x: 70,
                            y: height - 205,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Image file corrupted or missing from source', {
                            x: 70,
                            y: height - 220,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('You may try downloading this manuscript again later.', {
                            x: 50,
                            y: height - 250,
                            size: 10,
                            color: rgb(0.5, 0.5, 0.5),
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                        continue;
                    }
                    
                    // Process valid image (same logic as original function)
                    try {
                        await fs.access(imagePath);
                        const stats = await fs.stat(imagePath);
                        
                        if (stats.size < MIN_VALID_IMAGE_SIZE_BYTES) {
                            // Create informative page for corrupted/small image
                            const page = batchPdfDoc.addPage([595, 842]);
                            const { height } = page.getSize();
                            
                            page.drawText(`Page ${pageNumber} - File Corrupted`, {
                                x: 50,
                                y: height - 100,
                                size: 18,
                                color: rgb(0.6, 0.2, 0.2),
                            });
                            
                            page.drawText(`Image file was too small (${stats.size} bytes) or corrupted.`, {
                                x: 50,
                                y: height - 140,
                                size: 12,
                                color: rgb(0.4, 0.4, 0.4),
                            });
                            
                            page.drawText('The server provided an invalid or incomplete image file.', {
                                x: 50,
                                y: height - 170,
                                size: 11,
                                color: rgb(0.3, 0.3, 0.3),
                            });
                            
                            page.drawText('You may try downloading this manuscript again later.', {
                                x: 50,
                                y: height - 200,
                                size: 10,
                                color: rgb(0.5, 0.5, 0.5),
                            });
                            
                            pagesInBatch++;
                            processedCount++;
                            continue;
                        }
                        
                        const imageBuffer = await fs.readFile(imagePath);
                        
                        let image;
                        try {
                            image = await batchPdfDoc.embedJpg(imageBuffer);
                        } catch {
                            try {
                                image = await batchPdfDoc.embedPng(imageBuffer);
                            } catch (embedError: any) {
                                // Create informative page for embed failure
                                const page = batchPdfDoc.addPage([595, 842]);
                                const { height } = page.getSize();
                                
                                page.drawText(`Page ${pageNumber} - Format Error`, {
                                    x: 50,
                                    y: height - 100,
                                    size: 18,
                                    color: rgb(0.6, 0.2, 0.2),
                                });
                                
                                page.drawText('Image format not supported by PDF generator.', {
                                    x: 50,
                                    y: height - 140,
                                    size: 12,
                                    color: rgb(0.4, 0.4, 0.4),
                                });
                                
                                page.drawText('The image file exists but uses an unsupported format.', {
                                    x: 50,
                                    y: height - 170,
                                    size: 11,
                                    color: rgb(0.3, 0.3, 0.3),
                                });
                                
                                page.drawText('Please report this issue if it affects many pages.', {
                                    x: 50,
                                    y: height - 200,
                                    size: 10,
                                    color: rgb(0.5, 0.5, 0.5),
                                });
                                
                                pagesInBatch++;
                                processedCount++;
                                continue;
                            }
                        }
                        
                        const { width, height } = image;
                        const page = batchPdfDoc.addPage([width, height]);
                        page.drawImage(image, {
                            x: 0,
                            y: 0,
                            width,
                            height,
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                        
                    } catch (error: any) {
                        // Create informative page for any other errors
                        const page = batchPdfDoc.addPage([595, 842]);
                        const { height } = page.getSize();
                        
                        page.drawText(`Page ${pageNumber} - Processing Error`, {
                            x: 50,
                            y: height - 100,
                            size: 18,
                            color: rgb(0.6, 0.2, 0.2),
                        });
                        
                        page.drawText('An unexpected error occurred while processing this page.', {
                            x: 50,
                            y: height - 140,
                            size: 12,
                            color: rgb(0.4, 0.4, 0.4),
                        });
                        
                        page.drawText('Error details:', {
                            x: 50,
                            y: height - 170,
                            size: 11,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        const errorMsg = (error as Error).message || 'Unknown error occurred';
                        const truncatedError = errorMsg.length > 60 ? errorMsg.substring(0, 60) + '...' : errorMsg;
                        page.drawText(truncatedError, {
                            x: 50,
                            y: height - 190,
                            size: 9,
                            color: rgb(0.2, 0.2, 0.2),
                        });
                        
                        page.drawText('Please report this error if it affects many pages.', {
                            x: 50,
                            y: height - 220,
                            size: 10,
                            color: rgb(0.5, 0.5, 0.5),
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                    }
                }
                
                if (pagesInBatch > 0) {
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);
                    
                    // Log batch progress
                    const batchNum = Math.floor(i / batchSize) + 1;
                    const totalBatches = Math.ceil(totalImages / batchSize);
                    this.logger.log({
                        level: 'debug',
                        library: manifest?.library || 'unknown',
                        message: `PDF batch ${batchNum}/${totalBatches} processed: ${pagesInBatch} pages`,
                        details: { 
                            batchNum, 
                            totalBatches, 
                            pagesInBatch,
                            processedCount,
                            totalImages
                        }
                    });
                    
                    // Force garbage collection after each batch if available
                    if (global.gc) {
                        global.gc();
                        // For large manuscripta.se files, add extra memory cleanup time
                        if (manifest?.library === 'manuscripta' && totalImages > 200) {
                            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
                            const batchNum = Math.floor(i / batchSize) + 1;
                            const totalBatches = Math.ceil(totalImages / batchSize);
                            console.log(`Memory cleanup completed after batch ${batchNum}/${totalBatches}`);
                        }
                    }
                }
                
            } catch (batchError: any) {
                console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
            }
        }
        
        if (allPdfBytes.length === 0) {
            throw new Error('No pages were processed into PDF');
        }
        
        if (allPdfBytes.length === 1) {
            await fs.writeFile(outputPath, allPdfBytes[0]);
        } else {
            const finalPdfDoc = await PDFDocument.create();
            
            for (const pdfBytes of allPdfBytes) {
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pageIndices = pdfDoc.getPageIndices();
                const pages = await finalPdfDoc.copyPages(pdfDoc, pageIndices);
                pages.forEach((page) => finalPdfDoc.addPage(page));
            }
            
            const finalPdfBytes = await finalPdfDoc.save();
            await fs.writeFile(outputPath, finalPdfBytes);
        }
        
        // Log PDF creation complete
        const duration = Date.now() - startTime;
        const stats = await fs.stat(outputPath);
        this.logger.logPdfCreationComplete(
            manifest?.library || 'unknown',
            outputPath,
            stats.size,
            duration
        );
    }

    async loadFlorusManifest(florusUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Florus manifest for:', florusUrl);
        try {
            const response = await this.fetchDirect(florusUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch Florus page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            console.log('Florus page fetched, length:', html.length);
            
            // Extract manuscript code and current page from URL
            const urlParams = new URLSearchParams(florusUrl.split('?')[1]);
            const cote = urlParams.get('cote') || '';
            const currentVue = parseInt(urlParams.get('vue') || '1');
            
            if (!cote) {
                throw new Error('Invalid Florus URL: missing cote parameter');
            }
            
            // Parse the HTML to find the navigation structure and determine total pages
            console.log('Extracting Florus image URLs...');
            const pageLinks = await this.extractFlorusImageUrls(html, cote, currentVue);
            
            console.log(`Found ${pageLinks.length} pages for Florus manuscript`);
            if (pageLinks.length === 0) {
                throw new Error('No pages found in Florus manuscript');
            }
            
            // For Florus, we now have all pages loaded
            const manifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'florus' as const,
                displayName: `BM_Lyon_${cote}`,
                originalUrl: florusUrl,
            };
            
            console.log(`Florus manifest loaded: ${manifest.displayName}, total pages: ${pageLinks.length}`);
            return manifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Florus manuscript: ${(error as Error).message}`);
        }
    }

    private async extractFlorusImageUrls(html: string, cote: string, currentVue: number): Promise<string[]> {
        console.log('Extracting Florus URLs for manuscript:', cote);
        
        // Extract the image path from current page to understand the pattern
        const imagePathMatch = html.match(/FIF=([^&\s'"]+)/) ||
                              html.match(/image\s*:\s*'([^']+)'/) ||
                              html.match(/image\s*:\s*"([^"]+)"/);
        
        if (!imagePathMatch) {
            throw new Error('Could not find image path pattern in Florus page');
        }
        
        const currentImagePath = imagePathMatch[1];
        console.log('Current image path:', currentImagePath);
        
        // Extract the base path and manuscript ID
        // Example: /var/www/florus/web/ms/B693836101_MS0425/B693836101_MS0425_129_62V.JPG.tif
        const pathParts = currentImagePath.match(/(.+\/)([^/]+)\.JPG\.tif$/);
        if (!pathParts) {
            throw new Error('Could not parse Florus image path structure');
        }
        
        const basePath = pathParts[1];
        const filenameParts = pathParts[2].match(/^(.+?)_(\d+)_(.+)$/);
        if (!filenameParts) {
            throw new Error('Could not parse Florus filename structure');
        }
        
        // Find the total number of pages from navigation
        let maxPage = currentVue + 20; // Conservative fallback
        
        // Look for naviguer() function calls in the HTML
        const navNumbers = [...html.matchAll(/naviguer\((\d+)\)/g)]
            .map(match => parseInt(match[1]))
            .filter(num => !isNaN(num) && num > 0);
        
        console.log(`Found ${navNumbers.length} navigation numbers:`, navNumbers);
        
        if (navNumbers.length > 0) {
            maxPage = Math.max(...navNumbers);
            console.log(`Maximum page from navigation: ${maxPage}`);
        } else {
            console.log(`No navigation numbers found, using fallback: ${maxPage}`);
            // Try alternative patterns
            const altPatterns = [
                /href=["']javascript:naviguer\((\d+)\)/g,
                /onclick=["']naviguer\((\d+)\)/g,
                /naviguerSelect.*?value=["'](\d+)/g
            ];
            
            for (const pattern of altPatterns) {
                const altNumbers = [...html.matchAll(pattern)]
                    .map(match => parseInt(match[1]))
                    .filter(num => !isNaN(num) && num > 0);
                    
                if (altNumbers.length > 0) {
                    maxPage = Math.max(...altNumbers);
                    console.log(`Found ${altNumbers.length} pages using alternative pattern, max: ${maxPage}`);
                    break;
                }
            }
        }
        
        console.log(`Final detected page count: ${maxPage} pages for Florus manuscript`);
        
        const imageUrls: string[] = [];
        const serverUrl = 'https://florus.bm-lyon.fr/fcgi-bin/iipsrv.fcgi';
        
        // Batch fetch all pages to build complete URL list
        const batchSize = 10; // Process 10 pages concurrently
        const pageToFilename = new Map<number, string>();
        
        // For very large manuscripts, limit initial manifest loading to avoid timeouts
        const maxPagesToFetch = maxPage > 100 ? 50 : maxPage;
        console.log(`Fetching ${maxPagesToFetch} of ${maxPage} pages for initial manifest...`);
        
        // Process pages in batches for better performance
        for (let batchStart = 1; batchStart <= maxPagesToFetch; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, maxPagesToFetch);
            const batchPromises: Promise<void>[] = [];
            
            console.log(`Processing batch: pages ${batchStart} to ${batchEnd}`);
            
            for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
                const promise = (async () => {
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            const pageUrl = `https://florus.bm-lyon.fr/visualisation.php?cote=${cote}&vue=${pageNum}`;
                            const pageResponse = await this.fetchDirect(pageUrl);
                            
                            if (pageResponse.ok) {
                                const pageHtml = await pageResponse.text();
                                const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                                      pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                                      pageHtml.match(/image\s*:\s*"([^"]+)"/);
                                
                                if (pageImageMatch) {
                                    const imagePath = pageImageMatch[1];
                                    const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
                                    pageToFilename.set(pageNum, filename);
                                    if (pageNum <= 5 || pageNum === maxPage) {
                                        console.log(`Page ${pageNum} image path: ${imagePath}`);
                                    }
                                    break; // Success, exit retry loop
                                } else {
                                    console.warn(`No image match found for page ${pageNum}, HTML length: ${pageHtml.length}`);
                                    if (pageNum === 1) {
                                        console.log('Sample HTML for debugging:', pageHtml.substring(0, 500));
                                    }
                                    break; // No point retrying if pattern doesn't match
                                }
                            } else {
                                console.warn(`HTTP ${pageResponse.status} for page ${pageNum}`);
                                retries--;
                                if (retries > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                            }
                        } catch (error: any) {
                            console.warn(`Failed to fetch page ${pageNum} (${retries} retries left):`, (error as Error).message);
                            retries--;
                            if (retries > 0) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    }
                })();
                
                batchPromises.push(promise);
            }
            
            // Wait for current batch to complete before starting next
            try {
                await Promise.all(batchPromises);
                console.log(`Batch complete. Total pages fetched so far: ${pageToFilename.size}`);
            } catch (batchError) {
                console.error(`Error in batch ${batchStart}-${batchEnd}:`, batchError);
                // Continue with next batch even if current batch has errors
            }
            
            // Add a longer delay between batches to avoid overwhelming the server
            if (batchEnd < maxPagesToFetch) {
                console.log(`Waiting 500ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay for Lyon library
            }
        }
        
        console.log(`Successfully fetched ${pageToFilename.size} pages out of ${maxPagesToFetch} attempted (${maxPage} total)`);
        
        // Log some sample filenames to debug
        if (pageToFilename.size > 0) {
            const sampleEntries = Array.from(pageToFilename.entries()).slice(0, 5);
            console.log('Sample page mappings:', sampleEntries);
        }
        
        // Build the complete list of image URLs in order
        for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
            const filename = pageToFilename.get(pageNum);
            if (filename) {
                const imagePath = `${basePath}${filename}`;
                const imageUrl = `${serverUrl}?FIF=${imagePath}&WID=2000&CVT=JPEG`;
                imageUrls.push(imageUrl);
            } else if (pageNum <= maxPagesToFetch) {
                // Page was attempted but not found
                console.warn(`Missing page ${pageNum}, adding placeholder`);
                imageUrls.push('');
            } else {
                // Page wasn't fetched yet - will be fetched during download
                // Store metadata needed to fetch the page later
                const lazyUrl = `FLORUS_LAZY:${cote}:${pageNum}:${basePath}`;
                imageUrls.push(lazyUrl);
            }
        }
        
        // Filter out empty URLs but keep track of actual count
        const validUrls = imageUrls.filter(url => url !== '');
        
        if (validUrls.length === 0) {
            throw new Error('Could not extract any valid image URLs from Florus manuscript');
        }
        
        console.log(`Returning ${validUrls.length} valid URLs out of ${maxPage} total pages`);
        console.log(`First few URLs:`, imageUrls.slice(0, 3).filter(url => url !== ''));
        return imageUrls; // Return all URLs including placeholders to maintain correct indexing
    }

    async loadUnicattManifest(unicattUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract the book ID from the URL
            // Pattern: https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6
            const urlMatch = unicattUrl.match(/\/veneranda\/([^/?]+)/);
            if (!urlMatch) {
                throw new Error('Invalid Unicatt URL format - could not extract book ID');
            }
            
            const bookIdFull = urlMatch[1];
            const displayType = 'public'; // Based on JavaScript in the page
            
            // Build the folder structure as done in the JavaScript:
            // for (let i = 0; i < 15; i += 2) { bookId = bookId + bookIdFull.substring(i, i+2) + "/" }
            let bookIdPath = '';
            for (let i = 0; i < Math.min(15, bookIdFull.length); i += 2) {
                const segment = bookIdFull.substring(i, i + 2);
                if (segment.length > 0) {
                    bookIdPath += segment + '/';
                }
            }
            bookIdPath += bookIdFull;
            
            // Construct the manifest URL based on the pattern found in the HTML
            const manifestUrl = `https://digitallibrary.unicatt.it/veneranda/data/${displayType}/manifests/${bookIdPath}.json`;
            
            try {
                // Try to load the IIIF manifest with proxy fallback
                const response = await this.fetchWithProxyFallback(manifestUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to load Unicatt manifest: HTTP ${response.status}`);
                }
                
                const responseText = await response.text();
                let manifest;
                try {
                    manifest = JSON.parse(responseText);
                } catch {
                    throw new Error(`Invalid JSON response from Unicatt manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
                }
                
                // Process the IIIF manifest
                const pageLinks: string[] = [];
                
                // Handle IIIF v2/v3 format
                let canvases: any[] = [];
                
                if (manifest.sequences && Array.isArray(manifest.sequences)) {
                    // IIIF v2: canvases are in sequences
                    for (const sequence of manifest.sequences) {
                        const sequenceCanvases = sequence.canvases || [];
                        canvases.push(...sequenceCanvases);
                    }
                } else if (manifest.items && Array.isArray(manifest.items)) {
                    // IIIF v3: canvases are directly in manifest.items
                    canvases = manifest.items;
                } else {
                    // Fallback: try to find canvases in the manifest itself
                    canvases = manifest.canvases || [];
                }
                
                // Process each canvas to extract image URLs
                for (const canvas of canvases) {
                    let foundImages = false;
                    
                    // Check IIIF v2 format (canvas.images)
                    if (canvas.images && Array.isArray(canvas.images)) {
                        for (const image of canvas.images) {
                            let imageUrl;
                            
                            if (image.resource) {
                                imageUrl = image.resource['@id'] || image.resource.id;
                            } else if (image['@id']) {
                                imageUrl = image['@id'];
                            }
                            
                            if (imageUrl) {
                                // Convert to full resolution
                                if (imageUrl.includes('/full/')) {
                                    imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                }
                                pageLinks.push(imageUrl);
                                foundImages = true;
                            }
                        }
                    }
                    
                    // Check IIIF v3 format (canvas.items with AnnotationPages)
                    if (!foundImages && canvas.items && Array.isArray(canvas.items)) {
                        for (const item of canvas.items) {
                            if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                                for (const annotation of item.items) {
                                    if (annotation.body && annotation.body.id) {
                                        let imageUrl = annotation.body.id;
                                        
                                        // Convert to full resolution
                                        if (imageUrl.includes('/full/')) {
                                            imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                        }
                                        pageLinks.push(imageUrl);
                                        foundImages = true;
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No page links found in Unicatt IIIF manifest');
                }
                
                // Extract display name from manifest
                let displayName = `Unicatt_${bookIdFull}`;
                
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                        displayName = manifest.label.en[0];
                    } else if (manifest.label.it && Array.isArray(manifest.label.it)) {
                        displayName = manifest.label.it[0];
                    } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                        displayName = manifest.label.none[0];
                    } else if (typeof manifest.label === 'object') {
                        // Try to extract any language variant
                        const languages = Object.keys(manifest.label);
                        if (languages.length > 0 && Array.isArray(manifest.label[languages[0]])) {
                            displayName = manifest.label[languages[0]][0];
                        }
                    }
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    displayName: displayName,
                    library: 'unicatt',
                    originalUrl: unicattUrl
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Unicatt manifest: ${(error as Error).message}`);
            }
            
        } catch (error: any) {
            throw new Error(`Failed to load Unicatt manuscript: ${(error as Error).message}`);
        }
    }

    async loadCudlManifest(cudlUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = cudlUrl.match(/\/view\/([^/]+)/);
            if (!idMatch) {
                throw new Error('Invalid Cambridge CUDL URL format');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://cudl.lib.cam.ac.uk/iiif/${manuscriptId}`;
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch CUDL manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                const rawUrl = resource['@id'] || resource.id;
                // Convert bare IIIF identifier to proper IIIF image URL for Cambridge CUDL
                if (rawUrl && rawUrl.includes('images.lib.cam.ac.uk/iiif/')) {
                    return rawUrl + '/full/1000,/0/default.jpg';
                }
                return rawUrl;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'cudl',
                displayName: `Cambridge_${manuscriptId}`,
                originalUrl: cudlUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Cambridge CUDL manuscript: ${(error as Error).message}`);
        }
    }

    async loadTrinityCamManifest(trinityUrl: string): Promise<ManuscriptManifest> {
        try {
            const manuscriptIdMatch = trinityUrl.match(/\/Manuscript\/([^/]+)/);
            if (!manuscriptIdMatch) {
                throw new Error('Invalid Trinity College Cambridge URL format');
            }
            
            const manuscriptId = manuscriptIdMatch[1];
            const manifestUrl = `https://mss-cat.trin.cam.ac.uk/Manuscript/${manuscriptId}/manifest.json`;
            
            // Use intelligent progress monitoring for Trinity Cambridge as their server can be slow
            const progressMonitor = createProgressMonitor(
                'Trinity Cambridge manifest loading',
                'trinity',
                { initialTimeout: 60000, maxTimeout: 360000, progressCheckInterval: 20000 },
                {
                    onInitialTimeoutReached: (state) => {
                        console.log(`[Trinity] ${state.statusMessage}`);
                    },
                    onStuckDetected: (state) => {
                        console.warn(`[Trinity] ${state.statusMessage}`);
                    }
                }
            );
            
            const controller = progressMonitor.start();
            progressMonitor.updateProgress(0, 1, 'Loading Trinity Cambridge manifest...');
            
            try {
                const manifestResponse = await fetch(manifestUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json,application/ld+json,*/*',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                progressMonitor.updateProgress(1, 1, 'Trinity Cambridge manifest loaded successfully');
                
                if (!manifestResponse.ok) {
                    if (manifestResponse.status === 404) {
                        throw new Error(`Manuscript not found: ${manuscriptId}. Please check the URL is correct.`);
                    } else if (manifestResponse.status >= 500) {
                        throw new Error(`Trinity Cambridge server error (HTTP ${manifestResponse.status}). The server may be temporarily unavailable.`);
                    } else {
                        throw new Error(`Failed to fetch Trinity Cambridge manifest: HTTP ${manifestResponse.status}`);
                    }
                }
                
                const responseText = await manifestResponse.text();
                let iiifManifest;
                
                try {
                    iiifManifest = JSON.parse(responseText);
                } catch {
                    throw new Error(`Invalid JSON response from Trinity Cambridge. Response starts with: ${responseText.substring(0, 100)}`);
                }
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure from Trinity Cambridge');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    let imageUrl = resource['@id'] || resource.id;
                    
                    // For Trinity Cambridge, convert to smaller size for faster downloads
                    // Convert from /full/full/ to /full/1000,/ (1000px wide, loads in ~1.4s vs 45s)
                    if (imageUrl && imageUrl.includes('/full/full/')) {
                        imageUrl = imageUrl.replace('/full/full/', '/full/1000,/');
                    }
                    
                    return imageUrl;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in Trinity Cambridge manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'trinity_cam',
                    displayName: `TrinityC_${manuscriptId}`,
                    originalUrl: trinityUrl,
                };
                
            } catch (fetchError: any) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('Trinity Cambridge server request timed out. The server may be temporarily unavailable.');
                }
                throw fetchError;
            } finally {
                progressMonitor.complete();
            }
            
        } catch (error: any) {
            throw new Error(`Failed to load Trinity College Cambridge manuscript: ${(error as Error).message}`);
        }
    }

    async loadIsosManifest(isosUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = isosUrl.match(/\/([^/]+)\.html$/);
            if (!idMatch) {
                throw new Error('Invalid ISOS URL format');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://www.isos.dias.ie/static/manifests/${manuscriptId}.json`;
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch ISOS manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                
                // For ISOS, prefer the service URL format which works better with headers
                if (resource.service && (resource.service['@id'] || resource.service.id)) {
                    const serviceUrl = resource.service['@id'] || resource.service.id;
                    return serviceUrl + '/full/max/0/default.jpg';
                }
                
                // Fallback to resource ID
                return resource['@id'] || resource.id;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'isos',
                displayName: `ISOS_${manuscriptId}`,
                originalUrl: isosUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load ISOS manuscript: ${(error as Error).message}`);
        }
    }

    async loadMiraManifest(miraUrl: string): Promise<ManuscriptManifest> {
        try {
            const response = await this.fetchDirect(miraUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch MIRA page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Look for the manifest in the windows section which shows the default manifest for this MIRA item
            const windowsMatch = html.match(/windows:\s*\[\s*\{\s*manifestId:\s*"([^"]+)"/);
            if (!windowsMatch) {
                throw new Error('No IIIF manifest found in MIRA page windows configuration');
            }
            
            const manifestUrl = windowsMatch[1];
            console.log(`[MIRA] Found manifest URL: ${manifestUrl}`);
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch MIRA manifest: HTTP ${manifestResponse.status}`);
            }
            
            const manifestText = await manifestResponse.text();
            
            // Check if Trinity Dublin returned HTML instead of JSON (blocked/captcha)
            if (manifestUrl.includes('digitalcollections.tcd.ie') && manifestText.trim().startsWith('<')) {
                throw new Error('Trinity College Dublin manifests are currently blocked due to access restrictions. This MIRA item points to a Trinity Dublin manuscript that cannot be accessed programmatically.');
            }
            
            // Check for other institutions that might return HTML error pages
            if (manifestText.trim().startsWith('<')) {
                // Extract institution name from manifest URL for better error messages
                let institution = 'Unknown institution';
                if (manifestUrl.includes('digitalcollections.tcd.ie')) {
                    institution = 'Trinity College Dublin';
                } else if (manifestUrl.includes('isos.dias.ie')) {
                    institution = 'Irish Script on Screen (ISOS)';
                } else if (manifestUrl.includes('riaconservation.ie')) {
                    institution = 'Royal Irish Academy';
                }
                
                throw new Error(`Failed to access IIIF manifest from ${institution}. The manifest URL returned an HTML page instead of JSON data, indicating access restrictions or server issues. Manifest URL: ${manifestUrl}`);
            }
            
            let iiifManifest;
            try {
                iiifManifest = JSON.parse(manifestText);
            } catch (parseError: any) {
                throw new Error(`Invalid JSON manifest from ${manifestUrl}: ${parseError.message}`);
            }
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                return resource['@id'] || resource.id || resource.service?.['@id'] + '/full/max/0/default.jpg';
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            const urlMatch = miraUrl.match(/\/(\d+)$/);
            const manuscriptId = urlMatch ? urlMatch[1] : 'unknown';
            
            // Extract manuscript name from the page title if available
            const titleMatch = html.match(/<h1[^>]*>MIrA \d+:\s*([^<]+)<\/h1>/);
            const manuscriptName = titleMatch ? titleMatch[1].trim() : `MIRA_${manuscriptId}`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'mira',
                displayName: manuscriptName,
                originalUrl: miraUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load MIRA manuscript: ${(error as Error).message}`);
        }
    }

    async loadOrleansManifest(orleansUrl: string, progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
        console.log(`Starting Orleans manifest loading for: ${orleansUrl}`);
        
        try {
            // Handle different types of URLs:
            // 1. Media notice pages: https://mediatheques.orleans.fr/recherche/viewnotice/clef/.../id/745380
            // 2. Direct Aurelia URLs: https://aurelia.orleans.fr/s/aurelia/item/257012
            
            let itemId: string;
            const baseApiUrl = 'https://aurelia.orleans.fr/api';
            
            if (orleansUrl.includes('mediatheques.orleans.fr')) {
                // For media notice pages, search by title since ID mapping is complex
                let searchQuery = '';
                
                if (orleansUrl.includes('FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE')) {
                    // Direct search for the Augustine manuscript
                    searchQuery = 'Fragments de différents livres de l\'Écriture sainte';
                } else if (orleansUrl.includes('OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE')) {
                    // Direct search for the Pseudo Isidore manuscript
                    searchQuery = 'Ouvrages de Pseudo Isidore';
                } else {
                    // Try to extract and search for other manuscripts
                    const titleMatch = orleansUrl.match(/clef\/([^/]+)/);
                    if (titleMatch) {
                        const encodedTitle = titleMatch[1];
                        // Handle common Orleans URL patterns
                        let decodedTitle = decodeURIComponent(encodedTitle.replace(/--/g, ' '));
                        
                        // Apply transformations for common patterns
                        decodedTitle = decodedTitle
                            .replace(/([A-Z]+)DE([A-Z]+)/g, '$1 de $2') // Add "de" between uppercase words
                            .replace(/([A-Z])([A-Z]+)/g, (_match, first, rest) => first + rest.toLowerCase()) // Convert to proper case
                            .replace(/\s+/g, ' ') // Normalize spaces
                            .trim();
                        
                        searchQuery = decodedTitle;
                    } else {
                        throw new Error('Could not extract manuscript title from URL for search');
                    }
                }
                
                // Try multiple search strategies for better results
                let searchResults: any[] = [];
                const searchStrategies = [
                    searchQuery, // Original full query
                    searchQuery.split(' ').slice(0, 2).join(' '), // First two words
                    searchQuery.split(' ')[0], // First word only
                    searchQuery.toLowerCase(), // Lowercase version
                    searchQuery.toLowerCase().split(' ').slice(0, 2).join(' '), // Lowercase first two words
                    searchQuery.toLowerCase().split(' ')[0], // Lowercase first word
                    // Extract partial terms for complex titles
                    ...searchQuery.toLowerCase().split(' ').filter(word => word.length > 4) // Words longer than 4 chars
                ];
                
                for (let i = 0; i < searchStrategies.length && searchResults.length === 0; i++) {
                    const currentQuery = searchStrategies[i];
                    console.log(`Searching Orleans API (attempt ${i + 1}/${searchStrategies.length}) for: "${currentQuery}"`);
                    const searchUrl = `${baseApiUrl}/items?search=${encodeURIComponent(currentQuery)}`;
                    
                    try {
                        // Use fetchDirect with extended Orleans timeout
                        const searchResponse = await this.fetchDirect(searchUrl);
                        
                        if (!searchResponse.ok) {
                            console.warn(`Orleans search attempt ${i + 1} failed: HTTP ${searchResponse.status}`);
                            continue;
                        }
                        
                        const results = await searchResponse.json();
                        if (Array.isArray(results) && results.length > 0) {
                            searchResults = results;
                            console.log(`Orleans search attempt ${i + 1} returned ${results.length} results`);
                            break;
                        }
                    } catch (error: any) {
                        console.warn(`Orleans search attempt ${i + 1} failed:`, (error as Error).message);
                        if (i === searchStrategies.length - 1) {
                            throw error; // Re-throw on final attempt
                        }
                    }
                }
                
                if (!Array.isArray(searchResults) || searchResults.length === 0) {
                    throw new Error(`Manuscript not found in Orleans search results using any search strategy. Tried: ${searchStrategies.join(', ')}`);
                }
                
                itemId = searchResults[0]['o:id']?.toString() || searchResults[0].o_id?.toString();
                if (!itemId) {
                    throw new Error('Could not extract item ID from Orleans search results');
                }
                
                console.log(`Found Orleans manuscript with ID: ${itemId}`);
            } else if (orleansUrl.includes('aurelia.orleans.fr')) {
                // Direct Aurelia URL - extract item ID
                const itemMatch = orleansUrl.match(/\/item\/(\d+)/);
                if (!itemMatch) {
                    throw new Error('Invalid Aurelia URL format - could not extract item ID');
                }
                itemId = itemMatch[1];
            } else {
                throw new Error('Unsupported Orléans URL format');
            }
            
            // Fetch the item metadata with retry logic
            console.log(`Fetching Orleans item metadata for ID: ${itemId}`);
            const itemUrl = `${baseApiUrl}/items/${itemId}`;
            
            let itemData;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    // Use fetchDirect with extended Orleans timeout instead of manual timeout
                    const itemResponse = await this.fetchDirect(itemUrl);
                    
                    if (!itemResponse.ok) {
                        throw new Error(`Failed to fetch Orléans item: HTTP ${itemResponse.status}`);
                    }
                    
                    itemData = await itemResponse.json();
                    break;
                } catch (error: any) {
                    retryCount++;
                    console.warn(`Orleans item fetch attempt ${retryCount}/${maxRetries} failed:`, (error as Error).message);
                    
                    if (retryCount >= maxRetries) {
                        throw new Error(`Failed to fetch Orleans item after ${maxRetries} attempts: ${(error as Error).message}`);
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                }
            }
            console.log(`Successfully fetched Orleans item data`);
            
            // Extract media items from the Omeka item
            const mediaItems = itemData['o:media'] || itemData.o_media || [];
            
            if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
                throw new Error('No media items found in Orléans manuscript');
            }
            
            // Process media items to get IIIF URLs
            const pageLinks: string[] = [];
            console.log(`Processing ${mediaItems.length} media items for Orleans manuscript`);
            
            // Report initial progress
            progressCallback?.(0, mediaItems.length, `Loading manifest: 0/${mediaItems.length} pages`);
            
            // Process media items with batch processing and circuit breaker to prevent hanging
            let processedCount = 0;
            const batchSize = 4; // Smaller batches for Orleans to reduce API load
            const maxFailedBatches = 5; // Allow more failed batches before giving up
            const maxTotalFailures = Math.floor(mediaItems.length * 0.3); // Allow 30% failures max
            
            let failedBatchCount = 0;
            let totalFailures = 0;
            let lastProgressUpdate = Date.now();
            
            // For very large manuscripts (>200 pages), limit to first 200 pages to prevent hanging
            const maxPagesToProcess = Math.min(mediaItems.length, 200);
            if (mediaItems.length > 200) {
                console.log(`Orleans manuscript has ${mediaItems.length} pages, limiting to first ${maxPagesToProcess} pages for stability`);
                progressCallback?.(0, maxPagesToProcess, `Loading manifest (limited): 0/${maxPagesToProcess} pages`);
            }
            
            const itemsToProcess = mediaItems.slice(0, maxPagesToProcess);
            
            // Process items in batches with circuit breaker
            for (let batchStart = 0; batchStart < itemsToProcess.length; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize, itemsToProcess.length);
                const batch = itemsToProcess.slice(batchStart, batchEnd);
                
                console.log(`Orleans: processing batch ${Math.floor(batchStart / batchSize) + 1} (items ${batchStart + 1}-${batchEnd})`);
                
                // Process batch with Promise.allSettled for parallel processing
                const batchPromises = batch.map(async (mediaRef, batchIdx) => {
                    const idx = batchStart + batchIdx;
                    const mediaId = mediaRef['o:id'] || mediaRef.o_id || 
                                   (typeof mediaRef === 'object' && mediaRef['@id'] ? 
                                    mediaRef['@id'].split('/').pop() : mediaRef);
                    
                    if (!mediaId) {
                        throw new Error(`No media ID found for media item ${idx}`);
                    }
                    
                    const mediaUrl = `${baseApiUrl}/media/${mediaId}`;
                    
                    try {
                        const mediaResponse = await this.fetchDirect(mediaUrl);
                        
                        if (!mediaResponse.ok) {
                            throw new Error(`HTTP ${mediaResponse.status}`);
                        }
                        
                        const mediaData = await mediaResponse.json();
                        
                        // Orleans uses files/large/{hash}.jpg pattern - extract from thumbnail_display_urls or construct from filename
                        const thumbnails = mediaData.thumbnail_display_urls || mediaData['thumbnail_display_urls'];
                        
                        if (thumbnails && thumbnails.large) {
                            // Use the direct large thumbnail URL (preferred method)
                            return { idx, imageUrl: thumbnails.large, mediaId };
                        } else {
                            // Fallback: construct URL from o:filename hash
                            const filename = mediaData['o:filename'] || mediaData.o_filename;
                            if (filename && typeof filename === 'string') {
                                const imageUrl = `https://aurelia.orleans.fr/files/large/${filename}.jpg`;
                                return { idx, imageUrl, mediaId };
                            }
                        }
                        
                        throw new Error('No valid image URL found');
                        
                    } catch (fetchError: any) {
                        if (fetchError.name === 'AbortError') {
                            throw new Error(`Request timed out for media ${mediaId}`);
                        }
                        throw fetchError;
                    }
                });
                
                // Execute batch with timeout
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Process results and count failures
                let batchFailures = 0;
                
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        const { idx, imageUrl } = result.value;
                        pageLinks[idx] = imageUrl;
                        processedCount++;
                    } else {
                        batchFailures++;
                        totalFailures++;
                        console.warn(`Orleans batch processing error:`, result.reason?.message || result.reason);
                    }
                }
                
                // Circuit breaker logic
                if (batchFailures === batch.length) {
                    failedBatchCount++;
                    console.warn(`Orleans: entire batch failed (${failedBatchCount}/${maxFailedBatches} consecutive failures)`);
                    
                    if (failedBatchCount >= maxFailedBatches) {
                        throw new Error(`Orleans API appears to be blocked - ${maxFailedBatches} consecutive batch failures. Processed ${processedCount}/${itemsToProcess.length} pages.`);
                    }
                } else {
                    failedBatchCount = 0; // Reset consecutive failure count on any success
                }
                
                // Check total failure threshold
                if (totalFailures > maxTotalFailures) {
                    throw new Error(`Too many Orleans API failures (${totalFailures}/${itemsToProcess.length}). Server may be rate limiting. Processed ${processedCount} pages.`);
                }
                
                // Progress reporting and stall detection
                const now = Date.now();
                const shouldReport = processedCount % 10 === 0 || batchEnd >= itemsToProcess.length;
                
                if (shouldReport) {
                    const progressMessage = itemsToProcess.length < mediaItems.length 
                        ? `Loading manifest (limited): ${processedCount}/${itemsToProcess.length} pages`
                        : `Loading manifest: ${processedCount}/${itemsToProcess.length} pages`;
                    
                    console.log(`Orleans: processed ${processedCount}/${itemsToProcess.length} media items (${totalFailures} failures)`);
                    progressCallback?.(processedCount, itemsToProcess.length, progressMessage);
                    lastProgressUpdate = now;
                }
                
                // Check for stalled progress (no progress for >5 minutes)
                if (now - lastProgressUpdate > 300000) {
                    throw new Error(`Orleans manifest loading stalled - no progress for 5 minutes. Processed ${processedCount}/${itemsToProcess.length} pages.`);
                }
                
                // Add longer delay between batches to be respectful to the server
                if (batchEnd < itemsToProcess.length) {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between batches
                }
            }
            
            // Report final progress
            const finalMessage = itemsToProcess.length < mediaItems.length 
                ? `Manifest loaded (limited): ${processedCount} pages` 
                : `Manifest loaded: ${processedCount} pages`;
            progressCallback?.(processedCount, itemsToProcess.length, finalMessage);
            
            // Preserve page order by keeping original positions, only filter out sparse array gaps
            const validPageLinks: string[] = [];
            let validPageCount = 0;
            
            // Process pageLinks array in order, maintaining sequence
            for (let i = 0; i < pageLinks.length; i++) {
                const pageUrl = pageLinks[i];
                if (pageUrl && typeof pageUrl === 'string') {
                    validPageLinks.push(pageUrl);
                    validPageCount++;
                } else if (pageLinks[i] === undefined && i < itemsToProcess.length) {
                    // For failed pages within the expected range, log warning but don't break sequence
                    console.warn(`Orleans: Page ${i + 1} failed to load, skipping in sequence`);
                }
            }
            
            console.log(`Successfully processed ${validPageCount} page links for Orleans manuscript (maintained original order)`);
            
            if (validPageLinks.length === 0) {
                throw new Error('No valid image URLs found in Orléans manuscript');
            }
            
            // Ensure we have a reasonable number of pages (more lenient threshold)
            const minExpectedPages = Math.min(3, itemsToProcess.length * 0.05); // Only require 5% minimum
            if (validPageLinks.length < minExpectedPages) {
                console.warn(`Only ${validPageLinks.length}/${itemsToProcess.length} Orleans media items processed successfully`);
                
                // If we have very few pages, it might be worth throwing an error
                if (validPageLinks.length < 2) {
                    throw new Error(`Insufficient Orleans pages loaded: only ${validPageLinks.length} pages out of ${itemsToProcess.length} total`);
                }
            }
            
            // Log summary of processing
            if (itemsToProcess.length < mediaItems.length) {
                console.log(`Orleans: Successfully processed ${validPageLinks.length} pages (limited from ${mediaItems.length} total pages for stability)`);
            } else {
                console.log(`Orleans: Successfully processed ${validPageLinks.length}/${mediaItems.length} pages`);
            }
            
            // Extract display name from item metadata
            let displayName = 'Orleans_Manuscript';
            
            if (itemData['dcterms:title'] || itemData['dcterms_title']) {
                const titleProperty = itemData['dcterms:title'] || itemData['dcterms_title'];
                if (Array.isArray(titleProperty) && titleProperty.length > 0) {
                    displayName = titleProperty[0]['@value'] || titleProperty[0].value || titleProperty[0];
                } else if (typeof titleProperty === 'string') {
                    displayName = titleProperty;
                }
            } else if (itemData['o:title'] || itemData.o_title) {
                displayName = itemData['o:title'] || itemData.o_title;
            }
            
            // Sanitize display name for filesystem
            displayName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
            
            return {
                pageLinks: validPageLinks,
                totalPages: validPageLinks.length,
                displayName: displayName,
                library: 'orleans',
                originalUrl: orleansUrl,
            };
            
        } catch (error: any) {
            console.error(`Orleans manifest loading failed:`, error);
            throw new Error(`Failed to load Orléans manuscript: ${(error as Error).message}`);
        }
    }

    async loadRbmeManifest(rbmeUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading RBME manuscript: ${rbmeUrl}`);
            
            // Extract the item ID from the URL
            // Pattern: https://rbme.patrimonionacional.es/s/rbme/item/14374
            const idMatch = rbmeUrl.match(/\/item\/(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid RBME URL format - could not extract item ID');
            }
            
            const itemId = idMatch[1];
            console.log(`Extracted RBME item ID: ${itemId}`);
            
            // Fetch the RBME page to extract the manifest URL with intelligent monitoring
            console.log('Fetching RBME page content...');
            const pageProgressMonitor = createProgressMonitor(
                'RBME page loading',
                'rbme',
                { initialTimeout: 30000, maxTimeout: 120000 },
                {
                    onStuckDetected: (state) => {
                        console.warn(`[RBME] ${state.statusMessage} - Item: ${itemId}`);
                    }
                }
            );
            
            const pageController = pageProgressMonitor.start();
            pageProgressMonitor.updateProgress(0, 1, 'Loading RBME page...');
            
            let pageContent: string;
            try {
                const pageResponse = await this.fetchDirect(rbmeUrl, {
                    signal: pageController.signal,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!pageResponse.ok) {
                    throw new Error(`Failed to fetch RBME page: HTTP ${pageResponse.status} ${pageResponse.statusText}`);
                }
                
                pageContent = await pageResponse.text();
                console.log(`RBME page content loaded, length: ${pageContent.length}`);
                
            } catch (pageError: any) {
                if (pageError.name === 'AbortError') {
                    throw new Error('RBME page request timed out. The server may be experiencing high load.');
                }
                throw pageError;
            } finally {
                pageProgressMonitor.complete();
            }
            
            // Extract manifest URL from the page content
            // Look for manifest URL in Universal Viewer configuration or meta tags
            const manifestMatch = pageContent.match(/(?:manifest["']?\s*:\s*["']|"manifest"\s*:\s*["'])(https:\/\/rbdigital\.realbiblioteca\.es\/files\/manifests\/[^"']+)/);
            if (!manifestMatch) {
                console.error('Failed to find manifest URL in page content');
                console.log('Page content preview:', pageContent.substring(0, 500));
                throw new Error('Could not find IIIF manifest URL in RBME page');
            }
            
            const manifestUrl = manifestMatch[1];
            console.log(`Found RBME manifest URL: ${manifestUrl}`);
            
            // Fetch the IIIF manifest with intelligent monitoring
            const manifestProgressMonitor = createProgressMonitor(
                'RBME manifest loading',
                'rbme',
                { initialTimeout: 30000, maxTimeout: 120000 },
                {
                    onStuckDetected: (state) => {
                        console.warn(`[RBME] ${state.statusMessage} - URL: ${manifestUrl}`);
                    }
                }
            );
            
            const manifestController = manifestProgressMonitor.start();
            manifestProgressMonitor.updateProgress(0, 1, 'Loading RBME manifest...');
            
            let iiifManifest: any;
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl, {
                    signal: manifestController.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch RBME manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                iiifManifest = await manifestResponse.json();
                manifestProgressMonitor.updateProgress(1, 1, 'RBME manifest loaded successfully');
                console.log(`RBME manifest loaded successfully for item: ${itemId}`);
                
            } catch (manifestError: any) {
                if (manifestError.name === 'AbortError') {
                    throw new Error('RBME manifest request timed out. The server may be experiencing high load.');
                }
                throw manifestError;
            } finally {
                manifestProgressMonitor.complete();
            }
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                const serviceUrl = resource.service?.['@id'] || resource.service?.id;
                
                if (serviceUrl) {
                    // Use IIIF Image API to get full resolution images
                    return `${serviceUrl}/full/max/0/default.jpg`;
                } else {
                    // Fallback to direct image URL
                    return resource['@id'] || resource.id;
                }
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in RBME manifest');
            }
            
            // Extract title and metadata
            const label = iiifManifest.label || 'RBME Manuscript';
            const displayName = typeof label === 'string' ? label : (label?.['@value'] || label?.value || 'RBME Manuscript');
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 100);
            
            return {
                displayName: sanitizedName,
                totalPages: pageLinks.length,
                pageLinks,
                library: 'rbme' as any,
                originalUrl: rbmeUrl
            };
            
        } catch (error: any) {
            console.error(`RBME manifest loading failed:`, error);
            throw new Error(`Failed to load RBME manuscript: ${(error as Error).message}`);
        }
    }

    async loadParkerManifest(parkerUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract the manuscript ID from the URL
            // Pattern: https://parker.stanford.edu/parker/catalog/zs345bj2650
            const idMatch = parkerUrl.match(/\/catalog\/([^/]+)(?:\/|$)/);
            if (!idMatch) {
                throw new Error('Invalid Stanford Parker URL format - could not extract manuscript ID');
            }
            
            const manuscriptId = idMatch[1];
            // Stanford Parker IIIF manifest URL pattern
            const manifestUrl = `https://dms-data.stanford.edu/data/manifests/Parker/${manuscriptId}/manifest.json`;
            
            // Fetch the IIIF manifest
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch Stanford Parker manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            // Handle both IIIF v2 and v3 formats
            let canvases;
            if (iiifManifest.sequences && iiifManifest.sequences[0]) {
                // IIIF v2 format
                canvases = iiifManifest.sequences[0].canvases;
            } else if (iiifManifest.items) {
                // IIIF v3 format
                canvases = iiifManifest.items;
            } else {
                throw new Error('Invalid IIIF manifest structure - no sequences or items found');
            }
            
            if (!canvases || canvases.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            const pageLinks = canvases.map((canvas: any) => {
                let imageUrl;
                
                if (canvas.images && canvas.images[0]) {
                    // IIIF v2 format - Stanford Parker provides direct image URLs
                    const resource = canvas.images[0].resource;
                    // Use the direct image URL provided by Stanford Parker
                    imageUrl = resource['@id'] || resource.id;
                } else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                    // IIIF v3 format
                    const annotation = canvas.items[0].items[0];
                    const body = annotation.body;
                    imageUrl = body.id;
                }
                
                return imageUrl;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in Stanford Parker manifest');
            }
            
            // Extract title and metadata
            const label = iiifManifest.label || iiifManifest.title || 'Stanford Parker Manuscript';
            let displayName;
            
            if (typeof label === 'string') {
                displayName = label;
            } else if (label?.['@value']) {
                displayName = label['@value'];
            } else if (label?.value) {
                displayName = label.value;
            } else if (label?.en && Array.isArray(label.en)) {
                displayName = label.en[0];
            } else if (label?.en) {
                displayName = label.en;
            } else {
                displayName = `Stanford_Parker_${manuscriptId}`;
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 150);
            
            return {
                displayName: sanitizedName,
                totalPages: pageLinks.length,
                pageLinks,
                library: 'parker' as any,
                originalUrl: parkerUrl
            };
            
        } catch (error: any) {
            console.error(`Stanford Parker manifest loading failed:`, error);
            throw new Error(`Failed to load Stanford Parker manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Manuscripta.se manifest (using IIIF manifest API)
     */
    async loadManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Manuscripta.se manuscript: ${manuscriptaUrl}`);
            
            // Extract manuscript ID from URL: https://manuscripta.se/ms/101124 -> 101124
            const idMatch = manuscriptaUrl.match(/\/ms\/(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid Manuscripta.se URL format. Expected format: https://manuscripta.se/ms/{id}');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://manuscripta.se/iiif/${manuscriptId}/manifest.json`;
            
            console.log(`Loading Manuscripta.se manifest from: ${manifestUrl}`);
            
            // Use intelligent progress monitoring for Manuscripta.se with enhanced error handling
            const progressMonitor = createProgressMonitor(
                'Manuscripta.se manifest loading',
                'manuscripta',
                { initialTimeout: 60000, maxTimeout: 300000, progressCheckInterval: 15000 },
                {
                    onInitialTimeoutReached: (state) => {
                        console.log(`[Manuscripta.se] ${state.statusMessage}`);
                    },
                    onStuckDetected: (state) => {
                        console.warn(`[Manuscripta.se] ${state.statusMessage} - ID: ${manuscriptId}`);
                    },
                    onTimeout: (state) => {
                        console.error(`[Manuscripta.se] ${state.statusMessage} - ID: ${manuscriptId}`);
                    }
                }
            );
            
            const controller = progressMonitor.start();
            progressMonitor.updateProgress(0, 1, 'Loading Manuscripta.se manifest...');
            
            let iiifManifest: any;
            try {
                const manifestResponse = await this.fetchWithProxyFallback(manifestUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                progressMonitor.updateProgress(1, 1, 'Manuscripta.se manifest loaded successfully');
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch Manuscripta.se manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                iiifManifest = await manifestResponse.json();
                
                // Validate manifest structure
                if (!iiifManifest) {
                    throw new Error('Empty manifest received from Manuscripta.se');
                }
                
                console.log(`Manuscripta.se manifest loaded successfully for ID: ${manuscriptId}`);
                
            } catch (fetchError: any) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('Manuscripta.se manifest request timed out. The server may be experiencing high load.');
                }
                throw fetchError;
            } finally {
                progressMonitor.complete();
            }
            
            // Extract title from manifest
            let displayName = 'Manuscripta_' + manuscriptId;
            if (iiifManifest.label) {
                if (typeof iiifManifest.label === 'string') {
                    displayName = iiifManifest.label;
                } else if (Array.isArray(iiifManifest.label)) {
                    displayName = iiifManifest.label[0];
                } else if (typeof iiifManifest.label === 'object') {
                    // IIIF 3.0 format with language maps
                    const labelValues = Object.values(iiifManifest.label);
                    if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                        displayName = (labelValues[0] as string[])[0];
                    }
                }
            }
            
            // Parse IIIF manifest structure - support both IIIF 2.x and 3.x
            let canvases: any[] = [];
            
            if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                // IIIF 2.x structure
                canvases = iiifManifest.sequences[0].canvases;
            } else if (iiifManifest.items) {
                // IIIF 3.x structure
                canvases = iiifManifest.items;
            } else {
                throw new Error('Invalid IIIF manifest structure - no canvases found');
            }
            
            const pageLinks = canvases.map((canvas: any) => {
                let imageUrl: string | null = null;
                
                // IIIF 2.x format
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    imageUrl = resource['@id'] || resource.id;
                }
                // IIIF 3.x format
                else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                    const annotation = canvas.items[0].items[0];
                    if (annotation.body && annotation.body.id) {
                        imageUrl = annotation.body.id;
                    }
                }
                
                if (!imageUrl) {
                    return null;
                }
                
                // Convert to full resolution IIIF image URL if needed
                if (imageUrl.includes('/iiif/') && !imageUrl.includes('/full/')) {
                    // Ensure proper IIIF Image API format: {scheme}://{server}{/prefix}/{identifier}/full/max/0/default.jpg
                    const iiifBase = imageUrl.split('/info.json')[0];
                    return `${iiifBase}/full/max/0/default.jpg`;
                }
                
                return imageUrl;
            }).filter((link: string | null): link is string => link !== null);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            console.log(`Successfully loaded Manuscripta.se manifest: ${pageLinks.length} pages found`);
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                .replace(/\.+$/, '')
                .substring(0, 150) || `Manuscripta_${manuscriptId}`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'manuscripta' as any,
                displayName: sanitizedName,
                originalUrl: manuscriptaUrl,
            };
            
        } catch (error: any) {
            console.error(`Manuscripta.se manifest loading failed:`, error);
            throw new Error(`Failed to load Manuscripta.se manuscript: ${(error as Error).message}`);
        }
    }

    async loadInternetCulturaleManifest(internetCulturaleUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract OAI identifier from URL
            const oaiMatch = internetCulturaleUrl.match(/id=([^&]+)/);
            if (!oaiMatch) {
                throw new Error('Invalid Internet Culturale URL: missing OAI identifier');
            }
            
            const oaiId = decodeURIComponent(oaiMatch[1]);
            console.log(`Loading Internet Culturale manuscript with OAI ID: ${oaiId}`);
            
            // Extract teca parameter for institution info
            const tecaMatch = internetCulturaleUrl.match(/teca=([^&]+)/);
            const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
            
            // CRITICAL FIX: Establish session first by visiting main page
            console.log('Establishing Internet Culturale session...');
            const sessionHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Cache-Control': 'max-age=0'
            };
            
            // Visit main page to establish session and get cookies
            await this.fetchDirect(internetCulturaleUrl, { headers: sessionHeaders });
            
            // Construct API URL for manifest data with all required parameters
            const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
            
            // Set headers similar to browser request
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/xml, application/xml, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Referer': internetCulturaleUrl,
                'X-Requested-With': 'XMLHttpRequest',
            };
            
            console.log(`Fetching Internet Culturale API: ${apiUrl}`);
            
            // Fetch manifest data from API
            const response = await this.fetchDirect(apiUrl, { headers });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const xmlText = await response.text();
            
            if (!xmlText || xmlText.trim().length === 0) {
                throw new Error('Empty response from API');
            }
            
            // Parse XML response
            console.log('Parsing Internet Culturale XML manifest...');
            
            // Extract title from bibinfo section
            let displayName = 'Internet Culturale Manuscript';
            const titleMatch = xmlText.match(/<info key="Titolo">\s*<value>(.*?)<\/value>/);
            if (titleMatch) {
                displayName = titleMatch[1].trim();
            } else {
                // Fallback: extract from OAI ID
                const parts = oaiId.split(':');
                if (parts.length > 0) {
                    displayName = parts[parts.length - 1].replace(/%/g, ' ').trim();
                }
            }
            
            // Extract page URLs from XML with enhanced parsing and duplicate detection
            const pageLinks: string[] = [];
            
            // Try multiple regex patterns for different XML structures
            const pageRegexPatterns = [
                /<page[^>]+src="([^"]+)"[^>]*>/g,
                /<page[^>]*>([^<]+)<\/page>/g,
                /src="([^"]*cacheman[^"]*\.jpg)"/g,
                /url="([^"]*cacheman[^"]*\.jpg)"/g,
                /"([^"]*cacheman[^"]*\.jpg)"/g
            ];
            
            console.log(`[Internet Culturale] XML response length: ${xmlText.length} characters`);
            console.log(`[Internet Culturale] XML preview: ${xmlText.substring(0, 500)}...`);
            
            let foundPages = false;
            for (const pageRegex of pageRegexPatterns) {
                let match;
                const tempLinks: string[] = [];
                
                while ((match = pageRegex.exec(xmlText)) !== null) {
                    let relativePath = match[1];
                    
                    // Skip non-image URLs
                    if (!relativePath.includes('.jpg') && !relativePath.includes('.jpeg')) {
                        continue;
                    }
                    
                    // Optimize Internet Culturale resolution: use 'normal' for highest quality images
                    if (relativePath.includes('cacheman/web/')) {
                        relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                    }
                    
                    // Ensure absolute URL
                    const imageUrl = relativePath.startsWith('http') 
                        ? relativePath 
                        : `https://www.internetculturale.it/jmms/${relativePath}`;
                    
                    tempLinks.push(imageUrl);
                }
                
                if (tempLinks.length > 0) {
                    pageLinks.push(...tempLinks);
                    foundPages = true;
                    console.log(`[Internet Culturale] Found ${tempLinks.length} pages using regex pattern ${pageRegex.source}`);
                    break;
                }
            }
            
            if (!foundPages) {
                console.error('[Internet Culturale] No pages found with any regex pattern');
                console.log('[Internet Culturale] Full XML response:', xmlText);
                throw new Error('No image URLs found in XML manifest');
            }
            
            // Detect and handle duplicate URLs (infinite loop prevention)
            const urlCounts = new Map();
            const uniquePageLinks: string[] = [];
            
            pageLinks.forEach((url, index) => {
                const count = urlCounts.get(url) || 0;
                urlCounts.set(url, count + 1);
                
                if (count === 0) {
                    uniquePageLinks.push(url);
                } else {
                    console.warn(`[Internet Culturale] Duplicate URL detected for page ${index + 1}: ${url}`);
                }
            });
            
            // If only one unique page found, attempt to generate additional pages
            if (uniquePageLinks.length === 1 && pageLinks.length > 1) {
                console.warn(`[Internet Culturale] Only 1 unique page found but ${pageLinks.length} total pages expected`);
                console.log('[Internet Culturale] Attempting to generate additional page URLs...');
                
                const baseUrl = uniquePageLinks[0];
                const urlPattern = baseUrl.replace(/\/\d+\.jpg$/, '');
                
                // Generate URLs for pages 1-50 (reasonable limit)
                const generatedLinks: string[] = [];
                for (let i = 1; i <= Math.min(50, pageLinks.length); i++) {
                    const generatedUrl = `${urlPattern}/${i}.jpg`;
                    generatedLinks.push(generatedUrl);
                }
                
                console.log(`[Internet Culturale] Generated ${generatedLinks.length} page URLs from pattern`);
                pageLinks.length = 0; // Clear original array
                pageLinks.push(...generatedLinks);
            } else {
                // Use unique pages only
                pageLinks.length = 0;
                pageLinks.push(...uniquePageLinks);
            }
            
            console.log(`[Internet Culturale] Final page count: ${pageLinks.length} pages`);
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs found after duplicate removal');
            }
            
            // Add institution info to display name
            if (teca && teca !== 'Unknown') {
                displayName = `${displayName} (${teca})`;
            }
            
            // Sanitize display name for Windows file system
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`Internet Culturale manifest loaded: ${pageLinks.length} pages`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'internet_culturale' as any,
                displayName: sanitizedName,
                originalUrl: internetCulturaleUrl,
            };
            
        } catch (error: any) {
            console.error(`Internet Culturale manifest loading failed:`, error);
            throw new Error(`Failed to load Internet Culturale manuscript: ${(error as Error).message}`);
        }
    }

    async loadGrazManifest(grazUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading University of Graz manifest: ${grazUrl}`);
            
            // Extract manuscript ID from URL
            // URL patterns: 
            // - https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
            // - https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540
            // - https://unipub.uni-graz.at/download/webcache/1504/8224544 (direct image URL)
            let manuscriptId: string;
            
            // Handle direct image download URL pattern
            if (grazUrl.includes('/download/webcache/')) {
                // For webcache URLs, we can't reliably determine the manuscript ID from the page ID alone
                // These URLs are meant to be accessed directly, not used to load full manuscripts
                throw new Error('Direct webcache image URLs cannot be used to download full manuscripts. Please use a titleinfo or pageview URL instead (e.g., https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538)');
            } else {
                // Handle standard content URLs
                const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
                if (!manuscriptIdMatch) {
                    throw new Error('Could not extract manuscript ID from Graz URL');
                }
                
                manuscriptId = manuscriptIdMatch[1];
                
                // If this is a pageview URL, convert to titleinfo ID using known pattern
                // Pattern: pageview ID - 2 = titleinfo ID (e.g., 8224540 -> 8224538)
                if (grazUrl.includes('/pageview/')) {
                    const pageviewId = parseInt(manuscriptId);
                    const titleinfoId = (pageviewId - 2).toString();
                    console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
                    manuscriptId = titleinfoId;
                }
            }
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            console.log(`Fetching IIIF manifest from: ${manifestUrl}`);
            
            // Fetch the IIIF manifest with intelligent progress monitoring
            const headers = {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            
            // Use intelligent progress monitoring for Graz's large IIIF manifests (289KB)
            const progressMonitor = createProgressMonitor(
                'University of Graz manifest loading',
                'graz',
                { initialTimeout: 180000, maxTimeout: 900000, progressCheckInterval: 30000 },
                {
                    onInitialTimeoutReached: (state) => {
                        console.log(`[Graz] ${state.statusMessage}`);
                    },
                    onStuckDetected: (state) => {
                        console.warn(`[Graz] ${state.statusMessage}`);
                    },
                    onProgressResumed: (state) => {
                        console.log(`[Graz] ${state.statusMessage}`);
                    },
                    onTimeout: (state) => {
                        console.error(`[Graz] ${state.statusMessage}`);
                    }
                }
            );
            
            const controller = progressMonitor.start();
            progressMonitor.updateProgress(0, 1, 'Loading University of Graz IIIF manifest...');
            
            let response: Response;
            try {
                // Use fetchDirect instead of fetchWithProxyFallback to respect library-specific timeouts (2x multiplier for Graz)
                response = await this.fetchDirect(manifestUrl, { 
                    headers,
                    signal: controller.signal 
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch IIIF manifest: ${response.status} ${response.statusText}`);
                }
                
                progressMonitor.updateProgress(1, 1, 'IIIF manifest loaded successfully');
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    throw new Error('University of Graz manifest loading timed out. The manifest may be very large or the server may be experiencing issues.');
                }
                throw error;
            } finally {
                progressMonitor.complete();
            }
            
            const manifest = await response.json();
            console.log(`IIIF manifest loaded, processing canvases...`);
            
            const pageLinks: string[] = [];
            let displayName = 'University of Graz Manuscript';
            
            // Extract title from manifest metadata
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                } else if (manifest.label.en) {
                    displayName = Array.isArray(manifest.label.en) ? manifest.label.en[0] : manifest.label.en;
                } else if (manifest.label.de) {
                    displayName = Array.isArray(manifest.label.de) ? manifest.label.de[0] : manifest.label.de;
                }
            }
            
            // Process IIIF sequences and canvases
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases) {
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            let imageUrl = '';
                            
                            // Use webcache URLs for highest resolution
                            if (image.resource && image.resource['@id']) {
                                const resourceId = image.resource['@id'];
                                
                                // Convert webcache URLs to highest available resolution
                                // Pattern: https://unipub.uni-graz.at/download/webcache/SIZE/PAGE_ID
                                if (resourceId.includes('/download/webcache/')) {
                                    // Extract page ID from the URL
                                    const pageIdMatch = resourceId.match(/\/webcache\/\d+\/(\d+)$/);
                                    if (pageIdMatch) {
                                        const pageId = pageIdMatch[1];
                                        // Use highest available resolution (2000px)
                                        imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
                                    } else {
                                        console.warn(`University of Graz: Unexpected webcache URL format: ${resourceId}`);
                                        // Fallback to original URL if pattern doesn't match
                                        imageUrl = resourceId;
                                    }
                                } else {
                                    // Not a webcache URL, use as-is
                                    imageUrl = resourceId;
                                }
                            } else if (image.resource && image.resource.service && image.resource.service['@id']) {
                                // Legacy fallback to IIIF service URL (shouldn't be needed for Graz)
                                const serviceId = image.resource.service['@id'];
                                imageUrl = `${serviceId}/full/full/0/default.jpg`;
                                console.warn(`University of Graz: Using legacy IIIF service URL: ${imageUrl}`);
                            }
                            
                            if (imageUrl) {
                                pageLinks.push(imageUrl);
                            }
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No page images found in IIIF manifest');
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`University of Graz manifest loaded: ${pageLinks.length} pages`);
            if (pageLinks.length > 0) {
                console.log(`First page URL: ${pageLinks[0]}`);
                console.log(`Last page URL: ${pageLinks[pageLinks.length - 1]}`);
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'graz' as any,
                displayName: sanitizedName,
                originalUrl: grazUrl,
            };
            
        } catch (error: any) {
            console.error(`University of Graz manifest loading failed:`, error);
            
            // Enhanced error messages for specific network issues
            if (error.code === 'ETIMEDOUT') {
                throw new Error(`University of Graz connection timeout. The server is not responding - this may be due to high load or network issues. Please try again later or check if the manuscript is accessible through the Graz website at unipub.uni-graz.at`);
            }
            
            if (error.code === 'ECONNRESET') {
                throw new Error(`University of Graz connection was reset. The server closed the connection unexpectedly. This often happens with large manuscripts. Please try again in a few moments.`);
            }
            
            if (error.code === 'ENOTFOUND') {
                throw new Error(`University of Graz server could not be reached. Please check your internet connection and verify that unipub.uni-graz.at is accessible.`);
            }
            
            if (error.message?.includes('timeout')) {
                throw new Error(`University of Graz request timed out. Large manuscripts from Graz can take several minutes to load. The system automatically extends timeouts for Graz, but the server may still be experiencing issues. Please try again.`);
            }
            
            if (error.message?.includes('AbortError')) {
                throw new Error(`University of Graz manifest loading was cancelled. The manifest may be very large or the server may be experiencing issues. Please try again.`);
            }
            
            throw new Error(`Failed to load University of Graz manuscript: ${(error as Error).message}`);
        }
    }

    async loadCologneManifest(cologneUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Cologne Dom Library manifest: ${cologneUrl}`);
            
            // Determine collection and ID from URL
            // URL patterns:
            // - https://digital.dombibliothek-koeln.de/hs/content/zoom/156145
            // - https://digital.dombibliothek-koeln.de/schnuetgen/Handschriften/content/pageview/652610
            // - https://digital.dombibliothek-koeln.de/ddbkhd/Handschriften/content/pageview/94078
            
            let collection = 'hs'; // default collection
            let pageId = '';
            let displayName = 'Cologne Dom Library Manuscript';
            
            // Extract collection and page ID
            const hsMatch = cologneUrl.match(/\/hs\/content\/zoom\/(\d+)/);
            const schnuetgenMatch = cologneUrl.match(/\/schnuetgen\/[^/]+\/content\/pageview\/(\d+)/);
            const ddbkhdMatch = cologneUrl.match(/\/ddbkhd\/[^/]+\/content\/pageview\/(\d+)/);
            
            if (hsMatch) {
                collection = 'hs';
                pageId = hsMatch[1];
                displayName = 'Cologne Dom Library Manuscript';
            } else if (schnuetgenMatch) {
                collection = 'schnuetgen';
                pageId = schnuetgenMatch[1];
                displayName = 'Cologne Schnütgen Museum Manuscript';
            } else if (ddbkhdMatch) {
                collection = 'ddbkhd';
                pageId = ddbkhdMatch[1];
                displayName = 'Cologne DDBKHD Manuscript';
            } else {
                throw new Error('Could not extract collection and page ID from Cologne URL');
            }
            
            console.log(`Detected collection: ${collection}, page ID: ${pageId}`);
            
            // Fetch the viewer page to extract all page IDs
            const headers = {
                'Cookie': 'js_enabled=1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            };
            
            const response = await this.fetchDirect(cologneUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Cologne page: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            console.log(`Cologne page fetched, extracting page list...`);
            
            // Extract page IDs - try different methods based on page structure
            const pageIds: string[] = [];
            
            // Method 1: Try pageList div (for HS collection with zoom viewer)
            const pageListMatch = html.match(/<div id="pageList"[^>]*>.*?<\/div>/s);
            if (pageListMatch) {
                const pageListHtml = pageListMatch[0];
                const pageIdRegex = /data-id="(\d+)"/g;
                let match;
                while ((match = pageIdRegex.exec(pageListHtml)) !== null) {
                    pageIds.push(match[1]);
                }
                console.log(`Found ${pageIds.length} pages using pageList method`);
            }
            
            // Method 2: Try select dropdown options (for Schnütgen and DDBKHD collections)
            if (pageIds.length === 0) {
                const selectMatch = html.match(/<select[^>]*id="goToPages"[^>]*>.*?<\/select>/s);
                if (selectMatch) {
                    const selectHtml = selectMatch[0];
                    const optionRegex = /option value="(\d+)"/g;
                    let match;
                    while ((match = optionRegex.exec(selectHtml)) !== null) {
                        pageIds.push(match[1]);
                    }
                    console.log(`Found ${pageIds.length} pages using select dropdown method`);
                }
            }
            
            if (pageIds.length === 0) {
                throw new Error('No page IDs found in Cologne page using any method');
            }
            
            console.log(`Found ${pageIds.length} pages`);
            
            // Extract manuscript title from page metadata if available
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
            if (titleMatch) {
                const title = titleMatch[1]
                    .replace(/Handschriften der Diözesan- und Dombibliothek \/ /, '')
                    .replace(/ \[.*$/, '') // Remove trailing bracket content
                    .trim();
                
                if (title && title !== 'Handschriften der Diözesan- und Dombibliothek') {
                    displayName = title;
                }
            }
            
            // Build image URLs for highest resolution (2000px)
            const pageLinks: string[] = [];
            const baseUrl = 'https://digital.dombibliothek-koeln.de';
            
            for (const id of pageIds) {
                const imageUrl = `${baseUrl}/${collection}/download/webcache/2000/${id}`;
                pageLinks.push(imageUrl);
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`Cologne Dom Library manifest loaded: ${pageLinks.length} pages`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'cologne' as any,
                displayName: sanitizedName,
                originalUrl: cologneUrl,
            };
            
        } catch (error: any) {
            console.error(`Cologne Dom Library manifest loading failed:`, error);
            throw new Error(`Failed to load Cologne Dom Library manuscript: ${(error as Error).message}`);
        }
    }

    async loadViennaManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Vienna Manuscripta manifest for:', manuscriptaUrl);
        
        try {
            // Extract manuscript ID and page number from URL
            // Expected format: https://manuscripta.at/diglit/AT5000-XXXX/0001 (specific page)
            // or: https://manuscripta.at/diglit/AT5000-XXXX (entire manuscript)
            const urlMatch = manuscriptaUrl.match(/\/diglit\/(AT\d+-\d+)(?:\/(\d{4}))?/);
            if (!urlMatch) {
                throw new Error('Invalid Vienna Manuscripta URL format');
            }
            
            const manuscriptId = urlMatch[1];
            const startPage = urlMatch[2] ? parseInt(urlMatch[2], 10) : null;
            console.log('Manuscript ID:', manuscriptId);
            if (startPage) {
                console.log('Page range: Starting from page', startPage);
            } else {
                console.log('Page range: Entire manuscript');
            }
            
            // Try IIIF manifest first (much faster than page discovery)
            try {
                const manifestUrl = `https://manuscripta.at/diglit/iiif/${manuscriptId}/manifest.json`;
                console.log(`Vienna Manuscripta: Attempting IIIF manifest at ${manifestUrl}`);
                
                const manifestResponse = await this.fetchDirect(manifestUrl);
                if (manifestResponse.ok) {
                    const iiifManifest = await manifestResponse.json();
                    
                    if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                        const canvases = iiifManifest.sequences[0].canvases;
                        console.log(`Vienna Manuscripta: IIIF manifest loaded successfully with ${canvases.length} pages`);
                        
                        // Extract highest quality image URLs from IIIF manifest
                        const pageLinks = canvases.map((canvas: any) => {
                            if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                                const resource = canvas.images[0].resource;
                                
                                // Check for service URL (IIIF Image API)
                                if (resource.service && resource.service['@id']) {
                                    return resource.service['@id'] + '/full/max/0/default.jpg';
                                }
                                
                                // Fallback to resource @id
                                return resource['@id'] || resource.id;
                            }
                            return null;
                        }).filter((url: string | null): url is string => url !== null);
                        
                        if (pageLinks.length > 0) {
                            // DO NOT pre-filter pageLinks here to avoid hanging issues
                            // Page range filtering will be handled during download process
                            console.log(`Vienna Manuscripta: IIIF manifest loaded with ${pageLinks.length} total pages available`);
                            if (startPage !== null) {
                                console.log(`Vienna Manuscripta: URL specifies starting from page ${startPage} - this will be handled during download`);
                            }
                            
                            const displayName = iiifManifest.label || `Vienna_${manuscriptId}`;
                            
                            return {
                                pageLinks: pageLinks, // Return full page list, filtering handled in download
                                totalPages: pageLinks.length, // Total pages available
                                library: 'vienna_manuscripta' as const,
                                displayName: typeof displayName === 'string' ? displayName : displayName[0] || `Vienna_${manuscriptId}`,
                                originalUrl: manuscriptaUrl,
                                startPageFromUrl: startPage ?? undefined, // Store URL page number for later use
                            };
                        }
                    }
                }
            } catch (iiifError: any) {
                console.warn(`Vienna Manuscripta: IIIF manifest failed (${iiifError.message}), falling back to page discovery`);
            }
            
            // Fallback to direct image URL construction
            console.log('Vienna Manuscripta: Using direct image URL construction method');
            
            // Parse manuscript ID to build image path
            const parts = manuscriptId.match(/(AT)(\d+)-(\d+)/);
            if (!parts) {
                throw new Error('Invalid Vienna Manuscripta manuscript ID format');
            }
            
            const [, prefix, num1, num2] = parts;
            const imagePath = `https://manuscripta.at/images/${prefix}/${num1}/${manuscriptId}`;
            
            const pageLinks: string[] = [];
            let pageNum = 1;
            let consecutiveFailures = 0;
            
            // Probe for available pages by checking if images exist
            console.log(`Vienna Manuscripta: Probing for pages at ${imagePath}`);
            
            while (consecutiveFailures < 3 && pageNum <= 500) { // Stop after 3 consecutive 404s or 500 pages
                // Vienna uses folio notation: 001r, 001v, 002r, 002v, etc.
                const paddedPage = String(Math.ceil(pageNum / 2)).padStart(3, '0');
                const side = pageNum % 2 === 1 ? 'r' : 'v'; // odd = recto, even = verso
                const imageUrl = `${imagePath}/${manuscriptId}_${paddedPage}${side}.jpg`;
                
                try {
                    // Quick HEAD request to check if image exists
                    const response = await this.fetchDirect(imageUrl, { method: 'HEAD' });
                    
                    if (response.ok) {
                        pageLinks.push(imageUrl);
                        console.log(`Page ${pageNum} (${paddedPage}${side}): Found`);
                        consecutiveFailures = 0; // Reset failure counter
                    } else if (response.status === 404) {
                        console.log(`Page ${pageNum} (${paddedPage}${side}): Not found (404)`);
                        consecutiveFailures++;
                    } else {
                        console.log(`Page ${pageNum} (${paddedPage}${side}): HTTP ${response.status}`);
                        consecutiveFailures++;
                    }
                } catch (error: any) {
                    console.log(`Page ${pageNum} (${paddedPage}${side}): Network error - ${error.message}`);
                    consecutiveFailures++;
                }
                
                pageNum++;
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in Vienna Manuscripta manuscript');
            }
            
            // DO NOT pre-filter pageLinks here to avoid hanging issues
            // Page range filtering will be handled during download process
            console.log(`Vienna Manuscripta: Page discovery found ${pageLinks.length} total pages available`);
            if (startPage !== null) {
                console.log(`Vienna Manuscripta: URL specifies starting from page ${startPage} - this will be handled during download`);
            }
            
            // Extract manuscript name from first page for display name
            const displayName = `Vienna_${manuscriptId}`;
            
            const manifest: ManuscriptManifest = {
                pageLinks: pageLinks, // Return full page list, filtering handled in download
                totalPages: pageLinks.length, // Total pages available
                library: 'vienna_manuscripta' as const,
                displayName,
                originalUrl: manuscriptaUrl,
                startPageFromUrl: startPage ?? undefined, // Store URL page number for later use
            };
            
            console.log(`Vienna Manuscripta manifest loaded: ${displayName}, total pages: ${pageLinks.length}`);
            return manifest;
            
        } catch (error: any) {
            console.error('Vienna Manuscripta manifest loading failed:', error);
            throw new Error(`Failed to load Vienna Manuscripta manuscript: ${(error as Error).message}`);
        }
    }

    async loadRomeManifest(romeUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Rome National Library manifest for:', romeUrl);
        
        try {
            // Extract manuscript ID and collection type from URL
            // Expected formats: 
            // - http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1
            // - http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1
            const urlMatch = romeUrl.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
            if (!urlMatch) {
                throw new Error('Invalid Rome National Library URL format');
            }
            
            const [, collectionType, manuscriptId1, manuscriptId2] = urlMatch;
            
            // Verify that both parts of the manuscript ID are the same
            if (manuscriptId1 !== manuscriptId2) {
                throw new Error('Inconsistent manuscript ID in Rome URL');
            }
            
            const manuscriptId = manuscriptId1;
            console.log(`Processing Rome ${collectionType} manuscript: ${manuscriptId}`);
            
            // Fetch the first page to get metadata and examine image URLs
            // Apply enhanced error handling for BNC Roma infrastructure issues
            let pageResponse: Response;
            try {
                pageResponse = await this.fetchDirect(romeUrl);
            } catch (fetchError: any) {
                // Enhanced error handling for BNC Roma server infrastructure failures
                if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNRESET' || 
                    fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED' || 
                    fetchError.code === 'ETIMEDOUT' || fetchError.code === 'ENETUNREACH' ||
                    fetchError.message.includes('timeout') || fetchError.message.includes('ENETUNREACH')) {
                    throw new Error(`BNC Roma server infrastructure failure: The digital library server (digitale.bnc.roma.sbn.it) is currently unreachable. This appears to be a network infrastructure issue affecting the entire server. Please check the BNC Roma website (www.bncrm.beniculturali.it) for service announcements, or try again later. If the issue persists, contact GARR technical support at cert@garr.it or BNC Roma IT at bnc-rm.digitallibrary@beniculturali.it`);
                }
                throw new Error(`BNC Roma network connection failed: ${fetchError.message}`);
            }
            
            if (!pageResponse.ok) {
                if (pageResponse.status === 500) {
                    throw new Error(`BNC Roma server error (HTTP 500): The digital library server is experiencing internal issues. This may be a temporary server-side problem. Please try again in a few minutes, or check the BNC Roma website for service announcements.`);
                } else if (pageResponse.status === 503) {
                    throw new Error(`BNC Roma service unavailable (HTTP 503): The digital library is temporarily unavailable, possibly due to maintenance or high traffic. Please try again later.`);
                } else if (pageResponse.status === 404) {
                    throw new Error(`BNC Roma manuscript not found (HTTP 404): The requested manuscript may have been moved, removed, or the URL may be incorrect. Please verify the URL and try again.`);
                } else if (pageResponse.status === 403) {
                    throw new Error(`BNC Roma access denied (HTTP 403): Access to this manuscript may be restricted. Please check if authentication is required or if the manuscript is publicly available.`);
                } else if (pageResponse.status >= 500) {
                    throw new Error(`BNC Roma server error (HTTP ${pageResponse.status}): The digital library server is experiencing technical difficulties. Please try again later or contact BNC Roma support.`);
                } else {
                    throw new Error(`Failed to load Rome page: HTTP ${pageResponse.status} - ${pageResponse.statusText}`);
                }
            }
            
            const html = await pageResponse.text();
            
            // Extract title from the breadcrumbs or page content
            let title = manuscriptId; // fallback
            const titleMatch = html.match(/<title>([^<]+)<\/title>/) || 
                              html.match(/Dettaglio manoscritto[^>]*>[^:]*:\s*([^<]+)</) ||
                              html.match(/data-caption="([^"]+)"/);
            if (titleMatch) {
                title = titleMatch[1].trim().replace(/\s*-\s*Biblioteca.*/, '');
            }
            
            // Extract total page count from "Totale immagini: 175"
            const pageCountMatch = html.match(/Totale immagini:\s*(\d+)/);
            if (!pageCountMatch) {
                throw new Error('Could not extract page count from Rome manuscript page');
            }
            
            const totalPages = parseInt(pageCountMatch[1], 10);
            
            // Use the maximum resolution /original URL pattern for highest quality
            // /original provides 3-5x larger images compared to /full (tested 2025-07-02)
            // This pattern is known to work: http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/2/original
            const imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/PAGENUM/original`;
            console.log(`Using maximum resolution /original URL template for ${collectionType} collection: ${imageUrlTemplate.replace('PAGENUM', '1')} (first page example)`);
            
            // Generate page links using the determined template
            const pageLinks: string[] = [];
            for (let i = 1; i <= totalPages; i++) {
                pageLinks.push(imageUrlTemplate.replace('PAGENUM', i.toString()));
            }
            
            console.log(`Rome National Library: Found ${totalPages} pages for "${title}"`);
            console.log(`Using maximum resolution image URL template: ${imageUrlTemplate.replace('PAGENUM', '1')} (first page example)`);
            
            return {
                pageLinks,
                totalPages: totalPages,
                library: 'rome',
                displayName: title,
                originalUrl: romeUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Rome National Library manifest:', error);
            
            // Pass through enhanced error messages without modification
            if ((error as Error).message.includes('BNC Roma server infrastructure failure') || 
                (error as Error).message.includes('BNC Roma server error') || 
                (error as Error).message.includes('BNC Roma service unavailable') || 
                (error as Error).message.includes('BNC Roma manuscript not found') || 
                (error as Error).message.includes('BNC Roma access denied') || 
                (error as Error).message.includes('BNC Roma network connection failed')) {
                throw error;
            }
            
            // For other errors, provide general context
            if ((error as Error).message.includes('Invalid Rome National Library URL format') || 
                (error as Error).message.includes('Inconsistent manuscript ID')) {
                throw new Error(`BNC Roma URL format error: ${(error as Error).message}. Please ensure you're using a valid BNC Roma manuscript URL from digitale.bnc.roma.sbn.it`);
            }
            
            if ((error as Error).message.includes('Could not extract page count')) {
                throw new Error(`BNC Roma page parsing error: ${(error as Error).message}. The manuscript page format may have changed or the page content is incomplete.`);
            }
            
            throw new Error(`BNC Roma manuscript loading failed: ${(error as Error).message}. Please check the URL and try again, or contact support if the issue persists.`);
        }
    }

    /**
     * Load Berlin State Library manifest
     */
    async loadBerlinManifest(berlinUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Berlin State Library manifest for:', berlinUrl);
        
        try {
            // Extract PPN from URL
            // Expected formats:
            // https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001
            // https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677
            const ppnMatch = berlinUrl.match(/[?&]PPN=(PPN\d+)/);
            if (!ppnMatch) {
                throw new Error('Could not extract PPN from Berlin State Library URL');
            }
            
            const fullPpn = ppnMatch[1]; // e.g., "PPN782404456"
            const ppnNumber = fullPpn.replace('PPN', ''); // e.g., "782404456"
            
            // Fetch IIIF manifest
            const manifestUrl = `https://content.staatsbibliothek-berlin.de/dc/${fullPpn}/manifest`;
            console.log('Fetching Berlin manifest from:', manifestUrl);
            
            const manifestResponse = await this.fetchDirect(manifestUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!manifestResponse.ok) {
                throw new Error(`Failed to load Berlin IIIF manifest: HTTP ${manifestResponse.status}`);
            }
            
            const manifestData = await manifestResponse.json();
            
            // Extract metadata
            const title = manifestData.label || `Berlin Manuscript ${ppnNumber}`;
            
            // Get sequences and canvases
            if (!manifestData.sequences || manifestData.sequences.length === 0) {
                throw new Error('No sequences found in Berlin IIIF manifest');
            }
            
            const sequence = manifestData.sequences[0];
            const canvases = sequence.canvases || [];
            
            if (canvases.length === 0) {
                throw new Error('No canvases found in Berlin IIIF manifest');
            }
            
            // Generate page links from canvases
            const pageLinks: string[] = [];
            for (const canvas of canvases) {
                if (canvas.images && canvas.images.length > 0) {
                    const image = canvas.images[0];
                    if (image.resource && image.resource['@id']) {
                        // Use the direct image URL from the manifest
                        pageLinks.push(image.resource['@id']);
                    } else {
                        // Fallback: construct URL from canvas ID
                        // Canvas ID format: https://content.staatsbibliothek-berlin.de/dc/782404456-0001/canvas
                        const canvasMatch = canvas['@id'].match(/\/dc\/(\d+-\d+)\/canvas$/);
                        if (canvasMatch) {
                            const imageId = canvasMatch[1];
                            pageLinks.push(`https://content.staatsbibliothek-berlin.de/dc/${imageId}/full/full/0/default.jpg`);
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs found in Berlin IIIF manifest');
            }
            
            console.log(`Berlin State Library: Found ${pageLinks.length} pages for "${title}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'berlin',
                displayName: title,
                originalUrl: berlinUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Berlin State Library manifest:', error);
            throw new Error(`Failed to load Berlin State Library manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Czech Digital Library (VKOL) manifest
     */
    async loadCzechManifest(czechUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Czech Digital Library manifest for:', czechUrl);
        
        try {
            // Parse the URL to extract manuscript ID and base path
            // URL format: https://dig.vkol.cz/dig/mii87/0001rx.htm
            const urlMatch = czechUrl.match(/dig\.vkol\.cz\/dig\/([^/]+)\/(\d{4})[rv]x\.htm/);
            if (!urlMatch) {
                throw new Error('Could not parse Czech Digital Library URL format');
            }

            const [, manuscriptId] = urlMatch;
            
            console.log(`Czech library: manuscript ID ${manuscriptId}`);

            // Fetch the main page to get manuscript metadata
            const response = await this.fetchWithProxyFallback(czechUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Czech library page: HTTP ${response.status}`);
            }

            const htmlContent = await response.text();
            
            // Extract title/name from HTML - look for the manuscript title
            let title = `Czech Manuscript ${manuscriptId}`;
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                title = titleMatch[1].trim().replace(/\s+/g, ' ');
            }

            // Try to extract total page count from HTML content
            // Look for patterns like "185 ff." (folios) or similar folio count indicators
            let maxFolio = 185; // Default based on the example analysis
            
            const folioMatch = htmlContent.match(/(\d+)\s*ff?\.|Obsah.*?(\d+)\s*ff?\./i);
            if (folioMatch) {
                const detectedFolios = parseInt(folioMatch[1] || folioMatch[2]);
                if (detectedFolios > 0 && detectedFolios < 1000) { // Sanity check
                    maxFolio = detectedFolios;
                    console.log(`Czech library: detected ${maxFolio} folios from HTML content`);
                }
            }

            const pageLinks: string[] = [];

            // Generate page URLs for recto and verso pages
            // Pattern: 0001r, 0001v, 0002r, 0002v, etc.
            for (let folioNum = 1; folioNum <= maxFolio; folioNum++) {
                const paddedNum = folioNum.toString().padStart(4, '0');
                
                // Add recto page (r)
                const rectoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}r.jpg`;
                pageLinks.push(rectoImageUrl);
                
                // Add verso page (v)
                const versoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}v.jpg`;
                pageLinks.push(versoImageUrl);
            }

            console.log(`Czech Digital Library: Generated ${pageLinks.length} page URLs for "${title}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'czech',
                displayName: title,
                originalUrl: czechUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Czech Digital Library manifest:', error);
            throw new Error(`Failed to load Czech Digital Library manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Modena Diocesan Archive manifest by bypassing Flash interface and accessing mobile images directly
     */
    async loadModenaManifest(modenaUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Modena Diocesan Archive manuscript: ${modenaUrl}`);
            
            // Extract manuscript ID from URL
            // Expected format: https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/
            const manuscriptIdMatch = modenaUrl.match(/\/flip\/([^/]+)\/?$/);
            if (!manuscriptIdMatch) {
                throw new Error('Invalid Modena URL format. Expected: https://archiviodiocesano.mo.it/archivio/flip/MANUSCRIPT_ID/');
            }
            
            const manuscriptId = manuscriptIdMatch[1];
            console.log(`Extracted manuscript ID: ${manuscriptId}`);
            
            // Access mobile interface to determine page count
            const mobileUrl = `${modenaUrl.replace(/\/$/, '')}/mobile/index.html`;
            console.log(`Fetching mobile interface: ${mobileUrl}`);
            
            const mobileResponse = await this.fetchDirect(mobileUrl);
            const mobileHtml = await mobileResponse.text();
            
            // Extract total pages from JavaScript configuration
            // Look for total page count in mobile interface
            let totalPages = 0;
            
            // Try to extract from mobile page display (e.g., "Page: 1/11")
            const pageDisplayMatch = mobileHtml.match(/Page:\s*\d+\/(\d+)/);
            if (pageDisplayMatch) {
                const displayedTotal = parseInt(pageDisplayMatch[1]);
                console.log(`Found page display total: ${displayedTotal}`);
                if (!totalPages || displayedTotal > totalPages) {
                    totalPages = displayedTotal;
                }
            }
            
            // Try to extract from JavaScript config (more reliable for actual total)
            const totalPagesMatch = mobileHtml.match(/totalPages['":\s]*(\d+)/i);
            if (totalPagesMatch) {
                const jsTotal = parseInt(totalPagesMatch[1]);
                console.log(`Found JavaScript total pages: ${jsTotal}`);
                if (!totalPages || jsTotal > totalPages) {
                    totalPages = jsTotal;
                }
            }
            
            // Try to extract from data-pages attribute or similar
            const dataPagesMatch = mobileHtml.match(/data-pages[='"\s]*(\d+)/i);
            if (dataPagesMatch) {
                const dataTotal = parseInt(dataPagesMatch[1]);
                console.log(`Found data-pages total: ${dataTotal}`);
                if (!totalPages || dataTotal > totalPages) {
                    totalPages = dataTotal;
                }
            }
            
            // Try to extract from pages array or configuration
            const pagesArrayMatch = mobileHtml.match(/pages\s*[:=]\s*\[(.*?)\]/s);
            if (pagesArrayMatch) {
                const pagesContent = pagesArrayMatch[1];
                const pageCount = (pagesContent.match(/,/g) || []).length + 1;
                console.log(`Found pages array with ${pageCount} items`);
                if (!totalPages || pageCount > totalPages) {
                    totalPages = pageCount;
                }
            }
            
            // Fallback: try to determine by checking sequential image availability
            if (!totalPages) {
                console.log('No explicit page count found, attempting to determine by checking image availability');
                const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
                
                // Binary search to find the last available page
                let low = 1;
                let high = 500; // Reasonable upper bound
                let lastFound = 0;
                
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    const testUrl = `${baseImageUrl}${mid}.jpg`;
                    
                    try {
                        const testResponse = await this.fetchDirect(testUrl, { timeout: 5000 });
                        if (testResponse.ok) {
                            lastFound = mid;
                            low = mid + 1;
                        } else {
                            high = mid - 1;
                        }
                    } catch {
                        high = mid - 1;
                    }
                }
                
                if (lastFound > 0) {
                    totalPages = lastFound;
                    console.log(`Determined page count by availability check: ${totalPages}`);
                }
            }
            
            // Ultimate fallback only as last resort
            if (!totalPages) {
                console.warn('Could not determine page count, using fallback of 231 pages');
                totalPages = 231;
            }
            
            console.log(`Final determined page count: ${totalPages}`);
            
            // Verify that images are accessible by testing first page
            const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
            const firstPageUrl = `${baseImageUrl}1.jpg`;
            
            console.log(`Testing image access: ${firstPageUrl}`);
            const testResponse = await this.fetchDirect(firstPageUrl);
            if (!testResponse.ok) {
                throw new Error(`Cannot access manuscript images. Status: ${testResponse.status}`);
            }
            
            console.log(`Image access confirmed. Generating URLs for ${totalPages} pages`);
            
            // Generate page URLs using the discovered pattern
            const pageLinks: string[] = [];
            for (let page = 1; page <= totalPages; page++) {
                pageLinks.push(`${baseImageUrl}${page}.jpg`);
            }
            
            const displayName = `Modena_${manuscriptId}`;
            console.log(`Generated ${pageLinks.length} page URLs for "${displayName}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'modena',
                displayName,
                originalUrl: modenaUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Modena Diocesan Archive manifest:', error);
            throw new Error(`Failed to load Modena manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load BDL (Biblioteca Digitale Lombarda) manuscript manifest
     */
    async loadBDLManifest(bdlUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading BDL manuscript: ${bdlUrl}`);
            
            let manuscriptId: string | null = null;
            let pathType: string = 'fe'; // Default to public path
            
            // Handle different BDL URL formats
            if (bdlUrl.includes('/vufind/Record/BDL-OGGETTO-')) {
                // Format: https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903
                const match = bdlUrl.match(/BDL-OGGETTO-(\d+)/);
                if (match) {
                    manuscriptId = match[1];
                    console.log(`Extracted manuscript ID from vufind URL: ${manuscriptId}`);
                }
            } else if (bdlUrl.includes('/bdl/bookreader/')) {
                // Format: https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903
                const urlWithoutHash = bdlUrl.split('#')[0];
                const urlParams = new URLSearchParams(urlWithoutHash.split('?')[1]);
                manuscriptId = urlParams.get('cdOggetto');
                pathType = urlParams.get('path') || 'fe';
            } else {
                throw new Error('Unsupported BDL URL format. Please provide a valid BDL manuscript URL.');
            }
            
            if (!manuscriptId) {
                throw new Error('Could not extract manuscript ID from BDL URL.');
            }
            
            console.log(`Extracted manuscript ID: ${manuscriptId}, path: ${pathType}`);
            
            // Fetch pages JSON from BDL API with enhanced timeout
            // The API now uses 'public' path instead of 'fe' in the URL
            const pagesApiUrl = `https://www.bdl.servizirl.it/bdl/public/rest/json/item/${manuscriptId}/bookreader/pages`;
            console.log(`Fetching pages from: ${pagesApiUrl}`);
            
            // Use intelligent progress monitoring for BDL API call with enhanced timeouts
            const progressMonitor = createProgressMonitor(
                'BDL manifest loading',
                'bdl',
                { initialTimeout: 30000, maxTimeout: 90000 },
                {
                    onStuckDetected: (state) => {
                        console.warn(`[BDL] ${state.statusMessage}`);
                    }
                }
            );
            
            const controller = progressMonitor.start();
            progressMonitor.updateProgress(0, 1, 'Loading BDL pages data...');
            
            try {
                const response = await this.fetchWithProxyFallback(pagesApiUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                progressMonitor.updateProgress(1, 1, 'BDL pages data loaded successfully');
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch BDL pages: HTTP ${response.status} ${response.statusText}`);
                }
                
                const pagesData = await response.json();
                
                if (!Array.isArray(pagesData) || pagesData.length === 0) {
                    throw new Error('Invalid or empty pages data from BDL API');
                }
                
                console.log(`Found ${pagesData.length} pages in BDL manuscript`);
                
                // Extract image URLs from pages data with validation
                const pageLinks: string[] = [];
                
                for (const page of pagesData) {
                    if (page.idMediaServer) {
                        // Construct IIIF URL for full resolution image  
                        const imageUrl = `https://www.bdl.servizirl.it/cantaloupe//iiif/2/${page.idMediaServer}/full/max/0/default.jpg`;
                        pageLinks.push(imageUrl);
                    } else {
                        console.warn(`Page ${page.id || 'unknown'} missing idMediaServer, skipping`);
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs found in BDL pages data');
                }
                
                // Skip image validation for BDL due to IIIF server hanging issues
                // The API provides valid image IDs, but the IIIF server has timeout problems
                console.log('Skipping BDL image validation due to known IIIF server issues');
                console.log('Note: BDL IIIF server may have temporary issues, but manifest structure is valid');
                
                const displayName = `BDL_${manuscriptId}`;
                console.log(`Generated ${pageLinks.length} page URLs for "${displayName}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'bdl',
                    displayName,
                    originalUrl: bdlUrl
                };
                
            } catch (fetchError: any) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('BDL API request timed out. The BDL server (bdl.servizirl.it) may be experiencing high load or temporary connectivity issues. Please try again later.');
                }
                if (fetchError.message?.includes('fetch failed')) {
                    throw new Error('BDL server is currently unreachable. The BDL service (bdl.servizirl.it) may be temporarily down. Please check your internet connection and try again later.');
                }
                if (fetchError.message?.includes('HTTP 5')) {
                    throw new Error('BDL server is experiencing internal errors. Please try again in a few minutes.');
                }
                throw fetchError;
            } finally {
                progressMonitor.complete();
            }
            
        } catch (error: any) {
            console.error('Error loading BDL manuscript manifest:', error);
            throw new Error(`Failed to load BDL manuscript: ${(error as Error).message}`);
        }
    }

    /*
     * Write file with atomic operation and verification
     */
    private async writeFileWithVerification(outputPath: string, data: Buffer): Promise<void> {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Use atomic write pattern: write to temp file, then rename
        const tempPath = `${outputPath}.tmp`;
        
        try {
            // Write to temporary file first
            await fs.writeFile(tempPath, data);
            
            // Verify the temp file was written correctly
            const stats = await fs.stat(tempPath);
            if (stats.size !== data.length) {
                throw new Error(`File size mismatch: wrote ${data.length} bytes, got ${stats.size} bytes`);
            }
            
            // Atomically move temp file to final location
            await fs.rename(tempPath, outputPath);
            
            console.log(`✅ File written and verified: ${path.basename(outputPath)} (${(stats.size / (1024 * 1024)).toFixed(1)}MB)`);
            
        } catch (error: any) {
            // Clean up temp file if it exists
            try {
                await fs.unlink(tempPath);
            } catch {
                // Ignore cleanup errors
            }
            throw new Error(`File write verification failed: ${(error as Error).message}`);
        }
    }

    /**
     * Load Europeana manifest (using Record API to find external IIIF manifests)
     */
    async loadEuropeanaManifest(europeanaUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract collection ID and record ID from URL
            // Expected format: https://www.europeana.eu/en/item/{collectionId}/{recordId}
            const urlMatch = europeanaUrl.match(/\/item\/(\d+)\/([^/?]+)/);
            if (!urlMatch) {
                throw new Error('Invalid Europeana URL format');
            }
            
            const collectionId = urlMatch[1];
            const recordId = urlMatch[2];
            
            console.log(`Europeana: Loading record data for ${collectionId}/${recordId}`);
            
            // First, try to get external IIIF manifest URL via Europeana Record API
            const recordApiUrl = `https://api.europeana.eu/record/${collectionId}/${recordId}.json?wskey=api2demo`;
            
            try {
                const recordResponse = await this.fetchDirect(recordApiUrl);
                if (recordResponse.ok) {
                    const recordData = await recordResponse.json();
                    
                    // Look for external IIIF manifest in webResources
                    if (recordData.object?.aggregations?.[0]?.webResources) {
                        for (const resource of recordData.object.aggregations[0].webResources) {
                            if (resource.dctermsIsReferencedBy && Array.isArray(resource.dctermsIsReferencedBy)) {
                                for (const manifestUrl of resource.dctermsIsReferencedBy) {
                                    if (manifestUrl.includes('manifest.json') || manifestUrl.includes('/manifest')) {
                                        console.log(`Europeana: Found external IIIF manifest: ${manifestUrl}`);
                                        
                                        // Load the external IIIF manifest
                                        const externalManifest = await this.loadGenericIIIFManifest(manifestUrl, europeanaUrl, recordData.object?.proxies?.[0]?.dcTitle?.def?.[0] || `Europeana_${recordId}`);
                                        console.log(`Europeana: Successfully loaded external manifest with ${externalManifest.totalPages} pages`);
                                        return externalManifest;
                                    }
                                }
                            }
                        }
                    }
                    
                    console.log(`Europeana: No external IIIF manifest found in Record API, falling back to Europeana's own IIIF`);
                }
            } catch (error: any) {
                console.log(`Europeana: Record API failed (${(error as Error).message}), falling back to Europeana's own IIIF`);
            }
            
            // Fallback: Use Europeana's own IIIF manifest (limited)
            const manifestUrl = `https://iiif.europeana.eu/presentation/${collectionId}/${recordId}/manifest`;
            console.log(`Europeana: Loading Europeana's own IIIF manifest from ${manifestUrl}`);
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch Europeana IIIF manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure from Europeana');
            }
            
            const canvases = iiifManifest.sequences[0].canvases;
            console.log(`Europeana: Processing ${canvases.length} pages from Europeana's own IIIF manifest`);
            
            // Extract image URLs from IIIF manifest
            const pageLinks = canvases.map((canvas: any) => {
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    
                    // Check for IIIF Image API service
                    if (resource.service && resource.service['@id']) {
                        // Use full resolution IIIF Image API endpoint
                        return `${resource.service['@id']}/full/full/0/default.jpg`;
                    }
                    
                    // Fallback to direct resource URL
                    return resource['@id'] || resource.id;
                }
                return null;
            }).filter((url: string | null): url is string => url !== null);
            
            if (pageLinks.length === 0) {
                throw new Error('No image URLs found in Europeana IIIF manifest');
            }
            
            // Extract display name from manifest
            let displayName = `Europeana_${recordId}`;
            if (iiifManifest.label) {
                if (typeof iiifManifest.label === 'string') {
                    displayName = iiifManifest.label;
                } else if (Array.isArray(iiifManifest.label)) {
                    // Handle IIIF label array format with objects containing @value
                    const firstLabel = iiifManifest.label[0];
                    if (typeof firstLabel === 'string') {
                        displayName = firstLabel;
                    } else if (firstLabel && typeof firstLabel === 'object' && '@value' in firstLabel) {
                        displayName = firstLabel['@value'] as string;
                    } else {
                        displayName = firstLabel || displayName;
                    }
                } else if (typeof iiifManifest.label === 'object') {
                    // Handle multilingual labels (IIIF 3.0 format)
                    const labelValues = Object.values(iiifManifest.label);
                    if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                        displayName = (labelValues[0] as string[])[0] || displayName;
                    }
                }
            }
            
            const europeanaManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'europeana' as const,
                displayName,
                originalUrl: europeanaUrl,
            };
            
            console.log(`Europeana: Created manifest for "${displayName}" with ${pageLinks.length} pages`);
            return europeanaManifest;
            
        } catch (error: any) {
            console.error(`Failed to load Europeana manifest: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Load a generic IIIF manifest from any URL
     */
    async loadGenericIIIFManifest(manifestUrl: string, originalUrl: string, displayName: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading generic IIIF manifest from: ${manifestUrl}`);
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch IIIF manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const canvases = iiifManifest.sequences[0].canvases;
            console.log(`Generic IIIF: Processing ${canvases.length} pages from manifest`);
            
            // Extract image URLs from IIIF manifest
            const pageLinks = canvases.map((canvas: any) => {
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    
                    // Check for IIIF Image API service
                    if (resource.service && resource.service['@id']) {
                        // Use full resolution IIIF Image API endpoint
                        return `${resource.service['@id']}/full/full/0/default.jpg`;
                    } else if (resource.service && resource.service.id) {
                        // IIIF 3.0 format
                        return `${resource.service.id}/full/max/0/default.jpg`;
                    }
                    
                    // Fallback to direct resource URL
                    return resource['@id'] || resource.id;
                }
                return null;
            }).filter((url: string | null): url is string => url !== null);
            
            if (pageLinks.length === 0) {
                throw new Error('No image URLs found in IIIF manifest');
            }
            
            // Extract display name from manifest if not provided
            let finalDisplayName = displayName;
            if (!finalDisplayName && iiifManifest.label) {
                if (typeof iiifManifest.label === 'string') {
                    finalDisplayName = iiifManifest.label;
                } else if (Array.isArray(iiifManifest.label)) {
                    const firstLabel = iiifManifest.label[0];
                    if (typeof firstLabel === 'string') {
                        finalDisplayName = firstLabel;
                    } else if (firstLabel && typeof firstLabel === 'object' && '@value' in firstLabel) {
                        finalDisplayName = firstLabel['@value'] as string;
                    }
                } else if (typeof iiifManifest.label === 'object') {
                    // Handle multilingual labels (IIIF 3.0 format)
                    const labelValues = Object.values(iiifManifest.label);
                    if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                        finalDisplayName = (labelValues[0] as string[])[0];
                    }
                }
            }
            
            if (!finalDisplayName) {
                finalDisplayName = 'IIIF_Manuscript';
            }
            
            const manifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'europeana' as const, // Keep as europeana since this is called from Europeana context
                displayName: finalDisplayName,
                originalUrl,
            };
            
            console.log(`Generic IIIF: Created manifest for "${finalDisplayName}" with ${pageLinks.length} pages`);
            return manifest;
            
        } catch (error: any) {
            console.error(`Failed to load generic IIIF manifest: ${(error as Error).message}`);
            throw error;
        }
    }

    async loadEManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading e-manuscripta.ch manifest from: ${manuscriptaUrl}`);
            
            // Extract manuscript ID and library from URL
            // URL formats: 
            // - https://www.e-manuscripta.ch/{library}/content/zoom/{id} (single page view)
            // - https://www.e-manuscripta.ch/{library}/content/titleinfo/{id} (manuscript info page)
            // - https://www.e-manuscripta.ch/{library}/content/thumbview/{id} (thumbnail view/block)
            const urlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/;
            const urlMatch = manuscriptaUrl.match(urlPattern);
            
            if (!urlMatch) {
                throw new Error('Invalid e-manuscripta.ch URL format. Expected: https://www.e-manuscripta.ch/{library}/content/{zoom|titleinfo|thumbview}/{id}');
            }
            
            const [, library, urlType, manuscriptId] = urlMatch;
            
            console.log(`e-manuscripta: Detected URL type: ${urlType}, library: ${library}, ID: ${manuscriptId}`);
            
            // Handle different URL types
            if (urlType === 'titleinfo') {
                // For titleinfo URLs, extract all related thumbview blocks and aggregate them
                return await this.handleEManuscriptaTitleInfo(manuscriptaUrl, library, manuscriptId);
            } else if (urlType === 'thumbview') {
                // For thumbview URLs, process as individual blocks
                return await this.handleEManuscriptaThumbView(manuscriptaUrl, library, manuscriptId);
            }
            
            // Continue with existing zoom URL handling
            // Fetch the viewer page to extract metadata and determine page count
            const viewerResponse = await this.fetchDirect(manuscriptaUrl);
            if (!viewerResponse.ok) {
                throw new Error(`Failed to load viewer page: HTTP ${viewerResponse.status}`);
            }
            
            const viewerHtml = await viewerResponse.text();
            
            // Extract title/manuscript name from the page
            let displayName = `e-manuscripta ${manuscriptId}`;
            const titleMatch = viewerHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('e-manuscripta.ch')) {
                displayName = titleMatch[1].trim();
            }
            
            // Multi-method approach for robust page detection following Agent 5 recommendations
            let pageData: Array<{pageId: string, pageNumber: number}> = [];
            
            // METHOD 1: Parse goToPage dropdown (most reliable)
            pageData = await this.parseEManuscriptaDropdown(viewerHtml);
            
            if (pageData.length === 0) {
                // METHOD 2: Parse JavaScript configuration data
                console.log('e-manuscripta: Trying JavaScript config extraction');
                pageData = await this.parseEManuscriptaJSConfig(viewerHtml);
            }
            
            if (pageData.length === 0) {
                // METHOD 3: Deep HTML analysis with multiple patterns
                console.log('e-manuscripta: Trying deep HTML pattern analysis');
                pageData = await this.parseEManuscriptaDeepHTML(viewerHtml);
            }
            
            if (pageData.length === 0) {
                // METHOD 4: URL pattern discovery using current page as base
                console.log('e-manuscripta: Trying URL pattern discovery');
                pageData = await this.discoverEManuscriptaURLPattern(manuscriptId, library);
            }
            
            if (pageData.length === 0) {
                console.error('e-manuscripta: All parsing methods failed, cannot determine page structure');
                throw new Error('Unable to determine manuscript page structure - all parsing methods failed');
            }
            
            // Sort by page number to ensure correct order
            pageData.sort((a, b) => a.pageNumber - b.pageNumber);
            
            console.log(`e-manuscripta: Successfully found ${pageData.length} pages for ${displayName}`);
            console.log(`e-manuscripta: Page range [${pageData[0]?.pageNumber}] to [${pageData[pageData.length - 1]?.pageNumber}]`);
            console.log(`e-manuscripta: First page ID: ${pageData[0]?.pageId}, Last page ID: ${pageData[pageData.length - 1]?.pageId}`);
            
            // Generate page links using the actual page IDs (Agent 3 optimal URL pattern)
            const pageLinks: string[] = pageData.map(page => 
                `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.pageId}`
            );
            
            // Validate that URLs actually work by testing first few pages (Agent 4 recommendation)
            await this.validateEManuscriptaURLs(pageLinks.slice(0, 3));
            
            console.log(`e-manuscripta: Generated and validated ${pageLinks.length} image URLs`);
            
            const eManuscriptaManifest: ManuscriptManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'e_manuscripta',
                displayName,
                originalUrl: manuscriptaUrl,
            };
            
            console.log(`e-manuscripta: Created manifest for "${displayName}" with ${pageLinks.length} pages`);
            return eManuscriptaManifest;
            
        } catch (error: any) {
            console.error(`Failed to load e-manuscripta.ch manifest: ${(error as Error).message}`);
            throw error;
        }
    }

    private async parseEManuscriptaDropdown(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
        try {
            // Find the complete goToPage select element first
            const selectStart = html.indexOf('<select id="goToPages"');
            const selectEnd = html.indexOf('</select>', selectStart);
            
            if (selectStart === -1 || selectEnd === -1) {
                console.log('e-manuscripta: goToPages select element not found');
                return [];
            }
            
            const selectElement = html.substring(selectStart, selectEnd + 9);
            console.log(`e-manuscripta: Found goToPages select element (${selectElement.length} chars)`);
            
            // Parse options with multiple regex patterns for robustness
            const patterns = [
                /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*/g,
                /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*[^<]*/g,
                /<option[^>]*value=["'](\d+)["'][^>]*>\s*\[(\d+)\]/g,
            ];
            
            let pageMatches: RegExpMatchArray[] = [];
            for (const pattern of patterns) {
                pageMatches = Array.from(selectElement.matchAll(pattern));
                if (pageMatches.length > 0) {
                    console.log(`e-manuscripta: Dropdown parsing succeeded with pattern ${pattern.toString()}`);
                    break;
                }
            }
            
            if (pageMatches.length === 0) {
                console.log('e-manuscripta: No dropdown matches found with any pattern');
                return [];
            }
            
            const pageData = pageMatches.map(match => ({
                pageId: match[1],
                pageNumber: parseInt(match[2], 10)
            }));
            
            console.log(`e-manuscripta: Extracted ${pageData.length} pages from dropdown`);
            return pageData;
            
        } catch (error: any) {
            console.warn(`e-manuscripta: Dropdown parsing failed: ${(error as Error).message}`);
            return [];
        }
    }

    private async parseEManuscriptaJSConfig(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
        try {
            // Look for JavaScript configuration objects that might contain page data
            const jsPatterns = [
                /var\s+pageData\s*=\s*(\{[^}]+\})/,
                /window\.pageConfig\s*=\s*(\{[^}]+\})/,
                /"pages"\s*:\s*\[([^\]]+)\]/,
                /pageIds\s*:\s*\[([^\]]+)\]/,
            ];
            
            for (const pattern of jsPatterns) {
                const match = html.match(pattern);
                if (match) {
                    console.log(`e-manuscripta: Found JS config match: ${match[1].substring(0, 100)}...`);
                    // This would need more sophisticated parsing based on actual structure
                    // For now, return empty to fall back to next method
                }
            }
            
            return [];
        } catch (error: any) {
            console.warn(`e-manuscripta: JS config parsing failed: ${(error as Error).message}`);
            return [];
        }
    }

    private async parseEManuscriptaDeepHTML(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
        try {
            // Try multiple HTML parsing approaches
            const approaches = [
                // Approach 1: Look for page links in navigation
                () => {
                    const linkPattern = /href="[^"]*\/zoom\/(\d+)"[^>]*>\s*\[(\d+)\]/g;
                    return Array.from(html.matchAll(linkPattern));
                },
                // Approach 2: Look for data attributes
                () => {
                    const dataPattern = /data-page-id="(\d+)"[^>]*>\s*\[(\d+)\]/g;
                    return Array.from(html.matchAll(dataPattern));
                },
                // Approach 3: Look for any numeric patterns that could be page IDs
                () => {
                    const numericPattern = /\[(\d+)\][^<]*(?:id|page)[^<]*(\d{7,})/g;
                    return Array.from(html.matchAll(numericPattern));
                },
            ];
            
            for (let i = 0; i < approaches.length; i++) {
                try {
                    const matches = approaches[i]();
                    if (matches.length > 0) {
                        console.log(`e-manuscripta: Deep HTML approach ${i + 1} found ${matches.length} matches`);
                        const pageData = matches.map(match => ({
                            pageId: match[1],
                            pageNumber: parseInt(match[2], 10)
                        }));
                        if (pageData.length > 1) return pageData;
                    }
                } catch (error: any) {
                    console.warn(`e-manuscripta: Deep HTML approach ${i + 1} failed: ${(error as Error).message}`);
                }
            }
            
            return [];
        } catch (error: any) {
            console.warn(`e-manuscripta: Deep HTML parsing failed: ${(error as Error).message}`);
            return [];
        }
    }

    private async discoverEManuscriptaURLPattern(baseId: string, library: string): Promise<Array<{pageId: string, pageNumber: number}>> {
        try {
            console.log('e-manuscripta: Attempting URL pattern discovery');
            const baseIdNum = parseInt(baseId, 10);
            const testUrls: string[] = [];
            
            // Test sequential IDs around the base ID (Agent 2 found this pattern works)
            for (let i = 0; i < 10; i++) {
                testUrls.push(`https://www.e-manuscripta.ch/${library}/download/webcache/128/${baseIdNum + i}`);
            }
            
            const validPages: Array<{pageId: string, pageNumber: number}> = [];
            
            // Test URLs to see which ones return valid images
            for (let i = 0; i < testUrls.length; i++) {
                try {
                    const testResponse = await this.fetchDirect(testUrls[i]);
                    if (testResponse.ok && testResponse.headers.get('content-type')?.includes('image')) {
                        validPages.push({
                            pageId: (baseIdNum + i).toString(),
                            pageNumber: i + 1
                        });
                        console.log(`e-manuscripta: Validated page ${i + 1} with ID ${baseIdNum + i}`);
                    } else {
                        // Stop when we hit the first non-working URL
                        console.log(`e-manuscripta: URL pattern discovery stopped at page ${i + 1} (no more valid pages)`);
                        break;
                    }
                } catch (error: any) {
                    console.log(`e-manuscripta: URL test failed at page ${i + 1}: ${(error as Error).message}`);
                    break;
                }
                
                // Small delay to be respectful
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (validPages.length > 0) {
                console.log(`e-manuscripta: URL pattern discovery found ${validPages.length} valid pages`);
                
                // Extend the pattern to find all pages
                let pageCount = validPages.length;
                const maxPages = 1000; // Reasonable limit
                
                // Continue testing until we find the end
                for (let i = pageCount; i < maxPages; i++) {
                    try {
                        const testUrl = `https://www.e-manuscripta.ch/${library}/download/webcache/128/${baseIdNum + i}`;
                        const testResponse = await this.fetchDirect(testUrl);
                        
                        if (testResponse.ok && testResponse.headers.get('content-type')?.includes('image')) {
                            validPages.push({
                                pageId: (baseIdNum + i).toString(),
                                pageNumber: i + 1
                            });
                            pageCount++;
                        } else {
                            console.log(`e-manuscripta: Found end of manuscript at page ${i + 1}`);
                            break;
                        }
                    } catch (error: any) {
                        console.log(`e-manuscripta: Pattern discovery ended at page ${i + 1}: ${(error as Error).message}`);
                        break;
                    }
                    
                    // Progress logging
                    if ((i + 1) % 10 === 0) {
                        console.log(`e-manuscripta: Discovered ${i + 1} pages so far...`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                return validPages;
            }
            
            return [];
        } catch (error: any) {
            console.warn(`e-manuscripta: URL pattern discovery failed: ${(error as Error).message}`);
            return [];
        }
    }

    private async validateEManuscriptaURLs(testUrls: string[]): Promise<void> {
        try {
            console.log(`e-manuscripta: Validating ${testUrls.length} sample URLs`);
            
            for (let i = 0; i < testUrls.length; i++) {
                const response = await this.fetchDirect(testUrls[i]);
                if (!response.ok) {
                    throw new Error(`Validation failed for URL ${i + 1}: HTTP ${response.status}`);
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType?.includes('image')) {
                    throw new Error(`Validation failed for URL ${i + 1}: Not an image (${contentType})`);
                }
                
                console.log(`e-manuscripta: Validated URL ${i + 1}/${testUrls.length}`);
            }
            
            console.log('e-manuscripta: All sample URLs validated successfully');
        } catch (error: any) {
            console.error(`e-manuscripta: URL validation failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Handle E-Manuscripta titleinfo URLs by extracting all related thumbview blocks
     */
    private async handleEManuscriptaTitleInfo(titleinfoUrl: string, library: string, manuscriptId: string): Promise<ManuscriptManifest> {
        try {
            console.log(`e-manuscripta: Processing titleinfo URL for multi-block manuscript`);
            
            // Fetch the titleinfo page for title extraction
            const titleinfoResponse = await this.fetchDirect(titleinfoUrl);
            if (!titleinfoResponse.ok) {
                throw new Error(`Failed to fetch titleinfo page: HTTP ${titleinfoResponse.status}`);
            }
            
            const titleinfoHtml = await titleinfoResponse.text();
            
            // Extract title/manuscript name from the titleinfo page
            let displayName = `e-manuscripta ${manuscriptId}`;
            const titleMatch = titleinfoHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('e-manuscripta.ch')) {
                displayName = titleMatch[1].trim();
            }
            
            // ENHANCED: Fetch structure page to find ALL manuscript blocks
            console.log(`e-manuscripta: Fetching structure page to discover all manuscript blocks`);
            const structureUrl = `https://www.e-manuscripta.ch/${library}/content/structure/${manuscriptId}`;
            const structureResponse = await this.fetchDirect(structureUrl);
            if (!structureResponse.ok) {
                throw new Error(`Failed to fetch structure page: HTTP ${structureResponse.status}`);
            }
            
            const structureHtml = await structureResponse.text();
            
            // Extract all thumbview block URLs from the structure page (enhanced method)
            const thumbviewUrls = await this.extractAllThumbviewBlocksFromStructure(structureHtml, library);
            
            if (thumbviewUrls.length === 0) {
                throw new Error('No thumbview blocks found in structure page');
            }
            
            console.log(`e-manuscripta: Found ${thumbviewUrls.length} thumbview blocks in structure page`);
            
            // Process each thumbview block and aggregate all pages
            const allPageLinks: string[] = [];
            let totalPagesCount = 0;
            
            for (let i = 0; i < thumbviewUrls.length; i++) {
                const thumbviewUrl = thumbviewUrls[i];
                console.log(`e-manuscripta: Processing block ${i + 1}/${thumbviewUrls.length}: ${thumbviewUrl}`);
                
                try {
                    const blockManifest = await this.handleEManuscriptaThumbView(thumbviewUrl, library, thumbviewUrl.split('/').pop()!);
                    allPageLinks.push(...blockManifest.pageLinks);
                    totalPagesCount += blockManifest.totalPages;
                    
                    console.log(`e-manuscripta: Block ${i + 1} contributed ${blockManifest.totalPages} pages`);
                } catch (error: any) {
                    console.warn(`e-manuscripta: Failed to process block ${i + 1}: ${(error as Error).message}`);
                }
            }
            
            if (allPageLinks.length === 0) {
                throw new Error('No pages found in any thumbview blocks');
            }
            
            console.log(`e-manuscripta: Successfully aggregated ${allPageLinks.length} pages from ${thumbviewUrls.length} blocks`);
            
            return {
                pageLinks: allPageLinks,
                totalPages: allPageLinks.length,
                library: 'e_manuscripta',
                displayName: `${displayName} (${thumbviewUrls.length} blocks)`,
                originalUrl: titleinfoUrl,
            };
            
        } catch (error: any) {
            console.error(`e-manuscripta: titleinfo processing failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Handle E-Manuscripta thumbview URLs (individual blocks)
     */
    private async handleEManuscriptaThumbView(thumbviewUrl: string, library: string, blockId: string): Promise<ManuscriptManifest> {
        try {
            console.log(`e-manuscripta: Processing thumbview block: ${blockId}`);
            
            // Fetch the thumbview page
            const response = await this.fetchDirect(thumbviewUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch thumbview page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Extract title/manuscript name from the page
            let displayName = `e-manuscripta ${blockId}`;
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('e-manuscripta.ch')) {
                displayName = titleMatch[1].trim();
            }
            
            // Use existing parsing methods to extract page data
            let pageData: Array<{pageId: string, pageNumber: number}> = [];
            
            // METHOD 1: Parse goToPage dropdown (most reliable)
            pageData = await this.parseEManuscriptaDropdown(html);
            
            if (pageData.length === 0) {
                // METHOD 2: Parse JavaScript configuration data
                console.log(`e-manuscripta: Block ${blockId} - Trying JavaScript config extraction`);
                pageData = await this.parseEManuscriptaJSConfig(html);
            }
            
            if (pageData.length === 0) {
                // METHOD 3: Deep HTML analysis with multiple patterns
                console.log(`e-manuscripta: Block ${blockId} - Trying deep HTML pattern analysis`);
                pageData = await this.parseEManuscriptaDeepHTML(html);
            }
            
            if (pageData.length === 0) {
                // METHOD 4: URL pattern discovery using current page as base
                console.log(`e-manuscripta: Block ${blockId} - Trying URL pattern discovery`);
                pageData = await this.discoverEManuscriptaURLPattern(blockId, library);
            }
            
            if (pageData.length === 0) {
                console.warn(`e-manuscripta: Block ${blockId} - No pages found, skipping`);
                return {
                    pageLinks: [],
                    totalPages: 0,
                    library: 'e_manuscripta',
                    displayName: `${displayName} (empty block)`,
                    originalUrl: thumbviewUrl,
                };
            }
            
            // Sort by page number to ensure correct order
            pageData.sort((a, b) => a.pageNumber - b.pageNumber);
            
            console.log(`e-manuscripta: Block ${blockId} - Found ${pageData.length} pages`);
            
            // Generate page links using the optimal URL pattern
            const pageLinks: string[] = pageData.map(page => 
                `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.pageId}`
            );
            
            // Validate that URLs actually work by testing first few pages
            if (pageLinks.length > 0) {
                await this.validateEManuscriptaURLs(pageLinks.slice(0, Math.min(3, pageLinks.length)));
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'e_manuscripta',
                displayName,
                originalUrl: thumbviewUrl,
            };
            
        } catch (error: any) {
            console.error(`e-manuscripta: thumbview processing failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Extract ALL thumbview block URLs from structure page HTML (ENHANCED for multi-block manuscripts)
     */
    private async extractAllThumbviewBlocksFromStructure(structureHtml: string, library: string): Promise<string[]> {
        console.log(`e-manuscripta: Extracting all thumbview blocks from structure page`);
        
        // Extract all zoom IDs from structure page links
        const zoomPattern = /href="\/[^"]*\/content\/zoom\/(\d+)"/g;
        const zoomIds: string[] = [];
        let match;
        while ((match = zoomPattern.exec(structureHtml)) !== null) {
            zoomIds.push(match[1]);
        }
        
        // Remove duplicates and sort by ID
        const uniqueZoomIds = [...new Set(zoomIds)].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`e-manuscripta: Found ${uniqueZoomIds.length} unique zoom IDs in structure`);
        
        // Test each zoom ID to see which ones have valid thumbview blocks
        const validThumbviewUrls: string[] = [];
        
        for (const zoomId of uniqueZoomIds) {
            const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${zoomId}`;
            try {
                const response = await this.fetchDirect(thumbviewUrl, { method: 'HEAD' });
                if (response.ok) {
                    validThumbviewUrls.push(thumbviewUrl);
                    console.log(`e-manuscripta: ✓ Block ${zoomId} - Valid thumbview`);
                } else {
                    console.log(`e-manuscripta: ✗ Block ${zoomId} - HTTP ${response.status} (skipping)`);
                }
            } catch (error: any) {
                console.log(`e-manuscripta: ✗ Block ${zoomId} - Error: ${(error as Error).message} (skipping)`);
            }
        }
        
        console.log(`e-manuscripta: Validated ${validThumbviewUrls.length} out of ${uniqueZoomIds.length} potential blocks`);
        return validThumbviewUrls;
    }


    /**
     * Load Monte-Cassino manifest from OMNES platform
     */
    async loadMonteCassinoManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            let manuscriptId: string;
            
            // Handle different Monte-Cassino URL patterns
            if (originalUrl.includes('manus.iccu.sbn.it')) {
                // Extract catalog ID and find corresponding IIIF manifest
                const catalogMatch = originalUrl.match(/cnmd\/([^/?]+)/);
                if (!catalogMatch) {
                    throw new Error('Cannot extract catalog ID from Manus URL');
                }
                
                // Catalog ID to IIIF manuscript mapping based on OMNES platform
                const catalogId = catalogMatch[1];
                const catalogMappings: { [key: string]: string } = {
                    // Existing mappings (verified)
                    '0000313047': 'IT-FR0084_0339',
                    '0000313194': 'IT-FR0084_0271', 
                    '0000396781': 'IT-FR0084_0023',
                    
                    // Additional mappings discovered from OMNES catalog
                    '0000313037': 'IT-FR0084_0003',
                    '0000313038': 'IT-FR0084_0001',
                    '0000313039': 'IT-FR0084_0002',
                    '0000313048': 'IT-FR0084_0006',
                    '0000313049': 'IT-FR0084_0015',
                    '0000313053': 'IT-FR0084_0007',
                    '0000313054': 'IT-FR0084_0008',
                    '0000313055': 'IT-FR0084_0009',
                    '0000313056': 'IT-FR0084_0010',
                    '0000313057': 'IT-FR0084_0011',
                    '0000313058': 'IT-FR0084_0012',
                    '0000396666': 'IT-FR0084_0016',
                    '0000396667': 'IT-FR0084_0017',
                    '0000401004': 'IT-FR0084_0018'
                };
                
                if (catalogMappings[catalogId]) {
                    manuscriptId = catalogMappings[catalogId];
                } else {
                    // Special handling for catalog 0000313041 which is cataloged but not digitized
                    if (catalogId === '0000313041') {
                        throw new Error(
                            `Monte-Cassino catalog ID 0000313041 exists but is not digitized. ` +
                            `This manuscript is cataloged in ICCU but not available in the OMNES digital collection. ` +
                            `Available nearby manuscripts: 0000313047, 0000313048, 0000313049. ` +
                            `You can also browse all available manuscripts at https://omnes.dbseret.com/montecassino/`
                        );
                    }
                    
                    // Find nearby available alternatives for better user guidance
                    const catalogNum = parseInt(catalogId);
                    const availableIds = Object.keys(catalogMappings);
                    const nearest = availableIds
                        .map(id => ({ id, distance: Math.abs(parseInt(id) - catalogNum) }))
                        .sort((a, b) => a.distance - b.distance)
                        .slice(0, 3);
                    
                    const suggestions = nearest.map(n => `${n.id} (distance: ${n.distance})`).join(', ');
                    
                    throw new Error(
                        `Monte-Cassino catalog ID ${catalogId} is not available in the digital collection. ` +
                        `This manuscript may not be digitized. ` +
                        `Nearest available catalog IDs: ${suggestions}. ` +
                        `You can also use direct IIIF manifest URLs from https://omnes.dbseret.com/montecassino/`
                    );
                }
            } else if (originalUrl.includes('omnes.dbseret.com/montecassino/iiif/')) {
                // Direct IIIF manifest URL
                const iiifMatch = originalUrl.match(/montecassino\/iiif\/([^/]+)/);
                if (!iiifMatch) {
                    throw new Error('Cannot extract manuscript ID from OMNES URL');
                }
                manuscriptId = iiifMatch[1];
            } else {
                throw new Error('Unsupported Monte-Cassino URL format');
            }
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://omnes.dbseret.com/montecassino/iiif/${manuscriptId}/manifest`;
            
            // Fetch and parse IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
            }
            
            const manifestData = await response.json();
            
            // Validate IIIF manifest structure
            if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            // Extract page URLs
            const pageLinks = manifestData.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                if (resource.service && resource.service['@id']) {
                    return `${resource.service['@id']}/full/full/0/default.jpg`;
                } else if (resource['@id']) {
                    return resource['@id'];
                }
                return null;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'monte_cassino',
                displayName: `Monte_Cassino_${manuscriptId}`,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Monte-Cassino manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Vallicelliana manifest from DAM or JMMS platforms
     */
    async loadVallicellianManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            let displayName: string;
            
            if (originalUrl.includes('dam.iccu.sbn.it')) {
                // DAM system - direct manifest access
                if (originalUrl.includes('/manifest')) {
                    manifestUrl = originalUrl;
                } else {
                    const containerMatch = originalUrl.match(/containers\/([^/?]+)/);
                    if (!containerMatch) {
                        throw new Error('Cannot extract container ID from DAM URL');
                    }
                    manifestUrl = `https://dam.iccu.sbn.it/mol_46/containers/${containerMatch[1]}/manifest`;
                }
                displayName = `Vallicelliana_DAM_${originalUrl.match(/containers\/([^/?]+)/)?.[1] || 'unknown'}`;
                
            } else if (originalUrl.includes('jmms.iccu.sbn.it')) {
                // JMMS system - complex encoded URLs
                if (originalUrl.includes('/manifest.json')) {
                    manifestUrl = originalUrl;
                } else {
                    throw new Error('JMMS URLs must be direct manifest URLs');
                }
                displayName = `Vallicelliana_JMMS_${Date.now()}`;
                
            } else {
                throw new Error('Unsupported Vallicelliana URL format - must be DAM or JMMS URL');
            }
            
            // Fetch and parse IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
            }
            
            const manifestData = await response.json();
            
            // Handle both IIIF v2 and v3 structures
            let canvases: any[] = [];
            if (manifestData.sequences && manifestData.sequences[0] && manifestData.sequences[0].canvases) {
                // IIIF v2
                canvases = manifestData.sequences[0].canvases;
            } else if (manifestData.items) {
                // IIIF v3
                canvases = manifestData.items;
            } else {
                throw new Error('Invalid IIIF manifest structure - no canvases found');
            }
            
            // Extract page URLs
            const pageLinks = canvases.map((canvas: any) => {
                // IIIF v2 structure
                if (canvas.images && canvas.images[0]) {
                    const resource = canvas.images[0].resource;
                    if (resource.service && resource.service['@id']) {
                        return `${resource.service['@id']}/full/full/0/default.jpg`;
                    } else if (resource['@id']) {
                        return resource['@id'];
                    }
                }
                
                // IIIF v3 structure
                if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                    const annotation = canvas.items[0].items[0];
                    if (annotation.body && annotation.body.service && annotation.body.service[0]) {
                        const serviceId = annotation.body.service[0].id || annotation.body.service[0]['@id'];
                        return `${serviceId}/full/full/0/default.jpg`;
                    } else if (annotation.body && annotation.body.id) {
                        return annotation.body.id;
                    }
                }
                
                return null;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            // ENHANCED FIX: Comprehensive validation for incomplete manuscripts
            await this.validateManifestCompleteness(manifestData, pageLinks, originalUrl);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'vallicelliana',
                displayName: displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Vallicelliana manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Enhanced validation for manuscript completeness
     * Detects incomplete manifests and provides helpful error messages
     */
    private async validateManifestCompleteness(
        manifestData: any, 
        pageLinks: string[], 
        originalUrl: string
    ): Promise<void> {
        // Extract manuscript metadata
        const physicalDesc = this.extractPhysicalDescription(manifestData);
        const cnmdId = this.extractCNMDIdentifier(manifestData);
        const manuscriptTitle = this.extractManuscriptTitle(manifestData);
        
        // Parse expected folio count from physical description
        const expectedFolios = this.parseExpectedFolioCount(physicalDesc);
        
        console.log(`Manifest validation: Found ${pageLinks.length} pages, expected ~${expectedFolios} folios`);
        console.log(`Physical description: ${physicalDesc}`);
        console.log(`CNMD ID: ${cnmdId}`);
        
        // CRITICAL: Detect severely incomplete manuscripts (less than 10% of expected)
        if (expectedFolios > 0 && pageLinks.length < expectedFolios * 0.1) {
            const incompleteError = `INCOMPLETE MANUSCRIPT DETECTED\n\nThis manifest contains only ${pageLinks.length} pages, but the metadata indicates the complete manuscript should have approximately ${expectedFolios} folios.\n\nManuscript: ${manuscriptTitle}\nCNMD ID: ${cnmdId}\nPhysical Description: ${physicalDesc}\nCurrent URL: ${originalUrl}\n\nSOLUTIONS:\n1. This may be a partial/folio-level manifest. Look for a collection-level manifest.\n2. Try searching for the complete manuscript using the CNMD ID: ${cnmdId}\n3. Visit the library's main catalog: https://manus.iccu.sbn.it/cnmd/${cnmdId}\n4. Contact the library directly for the complete digital manuscript.\n\nThis error prevents downloading an incomplete manuscript that would mislead users.`;
            
            throw new Error(incompleteError);
        }
        
        // Warn for moderately incomplete manuscripts (less than 50% of expected)
        if (expectedFolios > 0 && pageLinks.length < expectedFolios * 0.5) {
            console.warn(`WARNING: This manifest may be incomplete. Found ${pageLinks.length} pages but expected ~${expectedFolios} folios based on metadata. Proceeding with download, but the manuscript may be partial.`);
        }
        
        // Standard single-page warning for when no metadata is available
        if (pageLinks.length === 1 && expectedFolios === 0) {
            const label = this.extractManuscriptTitle(manifestData);
            if (originalUrl.includes('dam.iccu.sbn.it')) {
                console.warn(`Single-page DAM ICCU manifest detected: "${label}". This is likely a folio-level manifest, not a complete manuscript.`);
            } else {
                console.warn(`Single-page manuscript detected: "${label}". This may be a single folio URL rather than the complete manuscript.`);
            }
        }
    }

    /**
     * Extract physical description from manifest metadata
     */
    private extractPhysicalDescription(manifestData: any): string {
        if (!manifestData.metadata || !Array.isArray(manifestData.metadata)) {
            return '';
        }
        
        for (const meta of manifestData.metadata) {
            if (meta.label && meta.value) {
                const labelText = this.getMetadataText(meta.label);
                const valueText = this.getMetadataText(meta.value);
                
                if (labelText.toLowerCase().includes('fisica') || 
                    labelText.toLowerCase().includes('physical')) {
                    return valueText;
                }
            }
        }
        
        return '';
    }

    /**
     * Extract CNMD identifier from manifest metadata
     */
    private extractCNMDIdentifier(manifestData: any): string {
        if (!manifestData.metadata || !Array.isArray(manifestData.metadata)) {
            return '';
        }
        
        for (const meta of manifestData.metadata) {
            if (meta.label && meta.value) {
                const labelText = this.getMetadataText(meta.label);
                const valueText = this.getMetadataText(meta.value);
                
                if (labelText.toLowerCase().includes('identificativo') ||
                    labelText.toLowerCase().includes('identifier')) {
                    if (valueText.includes('CNMD')) {
                        return valueText.replace(/CNMD\\\\?/g, '').replace(/CNMD\\/g, '');
                    }
                }
            }
        }
        
        return '';
    }

    /**
     * Extract manuscript title from manifest
     */
    private extractManuscriptTitle(manifestData: any): string {
        if (manifestData.label) {
            return this.getMetadataText(manifestData.label);
        }
        
        if (manifestData.metadata) {
            for (const meta of manifestData.metadata) {
                if (meta.label && meta.value) {
                    const labelText = this.getMetadataText(meta.label);
                    if (labelText.toLowerCase().includes('titolo') || 
                        labelText.toLowerCase().includes('title')) {
                        return this.getMetadataText(meta.value);
                    }
                }
            }
        }
        
        return 'Unknown Manuscript';
    }

    /**
     * Parse expected folio count from physical description
     */
    private parseExpectedFolioCount(physicalDesc: string): number {
        if (!physicalDesc) return 0;
        
        // Look for patterns like "cc. IV + 148 + I" or "ff. 123" or "carte 156"
        const patterns = [
            /cc\.\s*(?:[IVX]+\s*\+\s*)?(\d+)(?:\s*\+\s*[IVX]+)?/i,  // cc. IV + 148 + I
            /ff\.\s*(\d+)/i,                                          // ff. 123
            /carte\s*(\d+)/i,                                         // carte 156
            /folios?\s*(\d+)/i,                                       // folio 123
            /(\d+)\s*(?:cc|ff|carte|folios?)/i                       // 123 cc
        ];
        
        for (const pattern of patterns) {
            const match = physicalDesc.match(pattern);
            if (match) {
                const count = parseInt(match[1], 10);
                if (!isNaN(count) && count > 0) {
                    return count;
                }
            }
        }
        
        return 0;
    }

    /**
     * Extract text from IIIF metadata value (handle various formats)
     */
    private getMetadataText(value: any): string {
        if (typeof value === 'string') {
            return value;
        }
        
        if (Array.isArray(value)) {
            return value.map(v => this.getMetadataText(v)).join(', ');
        }
        
        if (value && typeof value === 'object') {
            // Handle language maps
            if (value.it) return this.getMetadataText(value.it);
            if (value.en) return this.getMetadataText(value.en);
            if (value['@value']) return value['@value'];
            
            return JSON.stringify(value);
        }
        
        return String(value || '');
    }

    /**
     * Load Omnes Vallicelliana manifest from omnes.dbseret.com/vallicelliana
     */
    async loadOmnesVallicellianManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            let displayName: string;
            
            // Handle both direct manifest URLs and viewer URLs
            if (originalUrl.includes('/manifest')) {
                manifestUrl = originalUrl;
                // Extract ID from manifest URL
                const idMatch = originalUrl.match(/iiif\/([^/]+)\/manifest/);
                displayName = idMatch ? `Vallicelliana ${idMatch[1]}` : 'Vallicelliana Manuscript';
            } else {
                // Extract ID from regular URL and construct manifest URL
                const idMatch = originalUrl.match(/omnes\.dbseret\.com\/vallicelliana\/iiif\/([^/?]+)/);
                if (!idMatch) {
                    throw new Error('Cannot extract manuscript ID from Omnes Vallicelliana URL');
                }
                const manuscriptId = idMatch[1];
                manifestUrl = `https://omnes.dbseret.com/vallicelliana/iiif/${manuscriptId}/manifest`;
                displayName = `Vallicelliana ${manuscriptId}`;
            }
            
            console.log(`Loading Omnes Vallicelliana manifest from: ${manifestUrl}`);
            
            // Fetch and parse IIIF manifest
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
            }
            
            const manifestData = await response.json();
            
            // Extract display name from manifest label
            if (manifestData.label) {
                displayName = manifestData.label;
            }
            
            // Get canvases from IIIF v2 structure
            const canvases = manifestData.sequences?.[0]?.canvases || [];
            if (canvases.length === 0) {
                throw new Error('No canvases found in manifest');
            }
            
            // Extract page URLs using full/full/0/default.jpg for maximum resolution
            const pageLinks = canvases.map((canvas: any) => {
                if (canvas.images && canvas.images[0]) {
                    const imageService = canvas.images[0].resource.service;
                    if (imageService && imageService['@id']) {
                        // Extract canvas ID and construct full resolution URL
                        const serviceId = imageService['@id'];
                        const canvasId = serviceId.split('/').pop();
                        return `https://omnes.dbseret.com/vallicelliana/iiif/2/${canvasId}/full/full/0/default.jpg`;
                    }
                }
                return null;
            }).filter((url: string) => url !== null);
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs found in manifest');
            }
            
            console.log(`Found ${pageLinks.length} pages in Omnes Vallicelliana manuscript: ${displayName}`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'omnes_vallicelliana' as any,
                displayName: displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Omnes Vallicelliana manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load ICCU API manifest for manus.iccu.sbn.it URLs
     */
    async loadIccuApiManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading ICCU API manuscript from: ${originalUrl}`);
            
            // Extract manuscript ID from URL
            const idMatch = originalUrl.match(/[?&]id=(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid ICCU URL format - cannot extract manuscript ID');
            }
            
            const manuscriptId = idMatch[1];
            console.log(`Extracted manuscript ID: ${manuscriptId}`);
            
            // Use the ICCU API to get manifest URLs
            const apiUrl = `/o/manus-api/title?_method=get&_path=%2Fo%2Fmanus-api%2Ftitle&id=${manuscriptId}`;
            const fullApiUrl = `https://manus.iccu.sbn.it${apiUrl}`;
            
            console.log(`Fetching ICCU API data from: ${fullApiUrl}`);
            
            const apiResponse = await this.fetchDirect(fullApiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Referer': originalUrl
                }
            });
            
            if (!apiResponse.ok) {
                throw new Error(`Failed to fetch ICCU API data: HTTP ${apiResponse.status}`);
            }
            
            const apiData = await apiResponse.json();
            console.log(`ICCU API response status:`, apiData.status);
            
            if (!apiData.data || !apiData.data.img || !apiData.data.img.src) {
                throw new Error('No thumbnail URL found in ICCU API response');
            }
            
            // Extract thumbnail URL and derive manifest URL
            const thumbnailUrl = apiData.data.img.src;
            console.log(`Found thumbnail URL: ${thumbnailUrl}`);
            
            // Convert thumbnail URL to manifest URL
            const manifestUrl = thumbnailUrl.replace('/thumbnail', '/manifest');
            console.log(`Derived manifest URL: ${manifestUrl}`);
            
            // Get the manuscript title for display
            const displayName = apiData.data.title || `ICCU Manuscript ${manuscriptId}`;
            console.log(`Display name: ${displayName}`);
            
            // Load the manifest using the vallicelliana handler (since it's a DAM URL)
            const manifest = await this.loadVallicellianManifest(manifestUrl);
            
            // Update the display name with the API-provided title
            manifest.displayName = displayName;
            
            return manifest;
            
        } catch (error: any) {
            console.error('ICCU API manifest loading error:', error);
            throw new Error(`Failed to load ICCU manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Verona (NBM) manifest
     */
    async loadVeronaManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            let displayName: string;
            
            if (originalUrl.includes('nbm.regione.veneto.it') && originalUrl.includes('/manifest/')) {
                // Direct manifest URL
                manifestUrl = originalUrl;
                const manifestMatch = originalUrl.match(/manifest\/([^.]+)\.json/);
                displayName = `Verona_NBM_${manifestMatch?.[1] || 'unknown'}`;
                
            } else if (originalUrl.includes('nuovabibliotecamanoscritta.it')) {
                // Extract codice from viewer page URL
                let codiceDigital: string | undefined;
                
                if (originalUrl.includes('codice=')) {
                    const codiceMatch = originalUrl.match(/codice=(\d+)/);
                    codiceDigital = codiceMatch?.[1];
                } else if (originalUrl.includes('codiceDigital=')) {
                    const codiceDigitalMatch = originalUrl.match(/codiceDigital=(\d+)/);
                    codiceDigital = codiceDigitalMatch?.[1];
                }
                
                if (!codiceDigital) {
                    throw new Error('Cannot extract codiceDigital from Verona URL');
                }
                
                // Extended mapping based on testing and research
                const manifestMappings: { [key: string]: string } = {
                    '12': 'CXLV1331',
                    '14': 'CVII1001',
                    '15': 'LXXXIX841',
                    '17': 'msClasseIII81',
                    // Note: codice 16 mapping not found yet
                    // Add more mappings as discovered
                };
                
                const manifestId = manifestMappings[codiceDigital];
                if (!manifestId) {
                    // Try dynamic discovery approach
                    console.log(`Attempting dynamic discovery for Verona codice=${codiceDigital}`);
                    
                    // Common manifest ID patterns observed:
                    // - Roman numerals with Arabic numbers: CVII1001, LXXXIX841
                    // - ms. prefix: msClasseIII81
                    // Since we can't predict the pattern, provide helpful error
                    throw new Error(
                        `Unknown Verona manuscript code: ${codiceDigital}\n` +
                        `Known codes: 12, 14, 15, 17\n` +
                        `To add support for this manuscript:\n` +
                        `1. Find the manifest ID by checking nbm.regione.veneto.it\n` +
                        `2. Add mapping to the manifestMappings object\n` +
                        `Example: '${codiceDigital}': 'MANIFEST_ID'`
                    );
                }
                
                manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifestId}.json`;
                displayName = `Verona_NBM_${manifestId}`;
                
            } else {
                throw new Error('Unsupported Verona URL format - must be NBM manifest URL or nuovabibliotecamanoscritta.it viewer URL');
            }
            
            // Fetch manifest with proper timeout handling
            console.log(`Loading Verona manifest: ${manifestUrl}`);
            this.logInfo('verona', manifestUrl, 'Starting Verona manifest fetch', {
                codiceDigital: originalUrl.includes('codice=') ? originalUrl.match(/codice=(\d+)/)?.[1] : undefined,
                manifestUrl
            });
            
            // Use fetchWithHTTPS for Verona to handle SSL/connection issues
            const response = await this.fetchWithHTTPS(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Manifest not found. The manuscript may have been moved or the ID mapping may be incorrect.`);
                }
                throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
            }
            
            const manifestData = await response.json();
            
            // Validate IIIF manifest structure
            if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const canvases = manifestData.sequences[0].canvases;
            console.log(`Found ${canvases.length} pages in Verona manuscript`);
            this.logInfo('verona', manifestUrl, `Verona manifest loaded successfully`, {
                totalPages: canvases.length,
                manuscriptLabel: manifestData.label || 'Unknown',
                manifestSize: JSON.stringify(manifestData).length
            });
            
            // Log progress every 10 pages during URL extraction
            let lastLoggedProgress = 0;
            
            // Extract page URLs with maximum quality
            const pageLinks = canvases.map((canvas: any, index: number) => {
                try {
                    const resource = canvas.images[0].resource;
                    
                    // NBM uses IIIF Image API - construct highest quality URL
                    if (resource.service && resource.service['@id']) {
                        const serviceId = resource.service['@id'].replace(/\/$/, ''); // Remove trailing slash to avoid double slashes
                        // Use full/full for maximum native resolution
                        const imageUrl = `${serviceId}/full/full/0/native.jpg`;
                        
                        // Log progress every 10 pages
                        if (index > 0 && index % 10 === 0 && index > lastLoggedProgress) {
                            lastLoggedProgress = index;
                            this.logInfo('verona', manifestUrl, `Processing page URLs`, {
                                processed: index + 1,
                                total: canvases.length,
                                percentage: Math.round(((index + 1) / canvases.length) * 100)
                            });
                        }
                        
                        return imageUrl;
                    } else if (resource['@id']) {
                        // Direct resource URL - already at full resolution
                        return resource['@id'];
                    }
                    
                    console.warn(`Page ${index + 1}: No valid image URL found`);
                    return null;
                } catch (err) {
                    console.warn(`Page ${index + 1}: Error extracting URL - ${err}`);
                    return null;
                }
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No valid page images found in manifest');
            }
            
            this.logInfo('verona', manifestUrl, `Verona manifest processing complete`, {
                validPages: pageLinks.length,
                skippedPages: canvases.length - pageLinks.length,
                firstPageUrl: pageLinks[0]?.substring(0, 100) + '...'
            });
            
            // Extract title from manifest
            const title = manifestData.label || manifestData['@label'] || displayName;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'verona',
                displayName: title || displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            // Provide specific error messages for common issues
            if (error.message.includes('timeout')) {
                throw new Error(
                    `Verona NBM server timeout. The server may be slow or overloaded. ` +
                    `Try again later or use a direct manifest URL if available.`
                );
            }
            throw new Error(`Failed to load Verona manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load DIAMM (Digital Image Archive of Medieval Music) manifest
     */
    async loadDiammManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            
            // Handle both musmed.eu viewer URLs and direct manifest URLs
            if (originalUrl.includes('musmed.eu/visualiseur-iiif')) {
                // Extract manifest URL from musmed.eu viewer parameters
                const urlParams = new URLSearchParams(originalUrl.split('?')[1]);
                const encodedManifest = urlParams.get('manifest');
                if (!encodedManifest) {
                    throw new Error('No manifest parameter found in DIAMM viewer URL');
                }
                manifestUrl = decodeURIComponent(encodedManifest);
            } else if (originalUrl.includes('iiif.diamm.net/manifests/')) {
                // Direct manifest URL
                manifestUrl = originalUrl;
            } else {
                throw new Error('Unsupported DIAMM URL format');
            }
            
            // Validate manifest URL format
            if (!manifestUrl.includes('iiif.diamm.net/manifests/')) {
                throw new Error('Invalid DIAMM manifest URL format');
            }
            
            // Load the IIIF manifest using DIAMM-specific processing for maximum resolution
            const manifest = await this.loadDiammSpecificManifest(manifestUrl);
            
            // Override library type to ensure correct identification
            manifest.library = 'diamm';
            
            return manifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load DIAMM manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load DIAMM-specific IIIF manifest with maximum resolution optimization
     */
    async loadDiammSpecificManifest(manifestUrl: string): Promise<ManuscriptManifest> {
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load DIAMM IIIF manifest: HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        let manifest;
        try {
            manifest = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON response from DIAMM manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        const pageLinks: string[] = [];
        
        // Handle IIIF v3 format (items directly in manifest) and IIIF v2 format (sequences)
        let canvases: any[] = [];
        
        if (manifest.items && Array.isArray(manifest.items)) {
            // IIIF v3: canvases are directly in manifest.items
            canvases = manifest.items;
        } else if (manifest.sequences && Array.isArray(manifest.sequences)) {
            // IIIF v2: canvases are in sequences
            for (const sequence of manifest.sequences) {
                const sequenceCanvases = sequence.canvases || [];
                canvases.push(...sequenceCanvases);
            }
        }
        
        let foundImages = false;
        
        // Process each canvas to extract image URLs
        for (const canvas of canvases) {
            // Handle IIIF v2 format (images array)
            if (canvas.images && Array.isArray(canvas.images)) {
                for (const image of canvas.images) {
                    let imageUrl = '';
                    
                    // Get image URL from resource
                    if (image.resource) {
                        if (image.resource.service && image.resource.service['@id']) {
                            // Use IIIF Image API service URL for maximum resolution
                            // For DIAMM, use /full/full/ instead of /full/max/ for highest quality
                            imageUrl = `${image.resource.service['@id']}/full/full/0/default.jpg`;
                        } else if (image.resource['@id']) {
                            imageUrl = image.resource['@id'];
                        } else if (image.resource.id) {
                            imageUrl = image.resource.id;
                        }
                    } else if (image['@id']) {
                        imageUrl = image['@id'];
                    }
                    
                    if (imageUrl) {
                        // For DIAMM, ensure we use full/full for maximum resolution
                        if (imageUrl.includes('/full/')) {
                            imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/full/');
                        }
                        pageLinks.push(imageUrl);
                        foundImages = true;
                    }
                }
            }
            
            // Handle IIIF v3 format (items with AnnotationPages)
            if (canvas.items && Array.isArray(canvas.items)) {
                for (const item of canvas.items) {
                    if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                        for (const annotation of item.items) {
                            if (annotation.body && annotation.body.id) {
                                let imageUrl = annotation.body.id;
                                
                                // For DIAMM, ensure we use full/full for maximum resolution
                                if (imageUrl.includes('/full/')) {
                                    imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/full/');
                                }
                                pageLinks.push(imageUrl);
                                foundImages = true;
                            }
                        }
                    }
                }
            }
        }
        
        if (!foundImages) {
            throw new Error(`No images found in DIAMM manifest. The manifest may be incomplete or corrupted. URL: ${manifestUrl}`);
        }
        
        const displayName = manifest.label || manifest.title || 'DIAMM Manuscript';
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName,
            library: 'diamm' as const,
            originalUrl: manifestUrl
        };
    }

    /**
     * Load BNE (Biblioteca Nacional de España) manifest
     */
    async loadBneManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL using regex
            const idMatch = originalUrl.match(/[?&]id=(\d+)/);
            if (!idMatch) {
                throw new Error('Could not extract manuscript ID from BNE URL');
            }
            
            const manuscriptId = idMatch[1];
            console.log(`Extracting BNE manuscript ID: ${manuscriptId}`);
            
            // Use robust page discovery (skip problematic PDF info endpoint)
            console.log('BNE: Using robust page discovery (hanging issue fixed)...');
            return this.robustBneDiscovery(manuscriptId, originalUrl);
            
        } catch (error: any) {
            throw new Error(`Failed to load BNE manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Robust BNE manuscript discovery - optimized with parallel processing
     * FIXED: Previous implementation was too slow with sequential HEAD requests
     */
    private async robustBneDiscovery(manuscriptId: string, originalUrl: string): Promise<ManuscriptManifest> {
        const discoveredPages: Array<{page: number, contentLength: string, contentType: string}> = [];
        const seenContentHashes = new Set<string>();
        const maxPages = 500; // Increased limit since parallel is faster
        const batchSize = 10; // Process 10 pages at once
        
        console.log('BNE: Starting optimized parallel page discovery...');
        
        // Create progress monitor for BNE discovery
        const progressMonitor = createProgressMonitor(
            'BNE page discovery',
            'bne',
            {
                initialTimeout: 30000,
                progressCheckInterval: 10000,
                maxTimeout: 180000
            }
        );
        
        const controller = progressMonitor.start();
        
        try {
        
        for (let batchStart = 1; batchStart <= maxPages; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, maxPages);
            
            // Show progress more frequently for better UX
            if (batchStart % 20 === 1) {
                console.log(`BNE: Processing pages ${batchStart}-${batchEnd}...`);
            }
            
            // Update progress monitor
            progressMonitor.updateProgress(batchStart, maxPages, `Checking pages ${batchStart}-${batchEnd}...`);
            
            // Create promises for batch
            const batchPromises: Promise<{page: number, response: Response | null, error: any}>[] = [];
            for (let page = batchStart; page <= batchEnd; page++) {
                const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
                batchPromises.push(
                    this.fetchBneWithHttps(testUrl, { method: 'HEAD' })
                        .then(response => ({ page, response, error: null }))
                        .catch(error => ({ page, response: null, error }))
                );
            }
            
            // Wait for all in batch
            const batchResults = await Promise.all(batchPromises);
            
            // Process results and check for stop conditions
            let validPagesInBatch = 0;
            let errorsInBatch = 0;
            
            for (const result of batchResults) {
                if (result.error) {
                    errorsInBatch++;
                } else if (result.response && result.response.ok) {
                    const contentLength = result.response.headers.get('content-length');
                    const contentType = result.response.headers.get('content-type');
                    
                    if (contentLength && parseInt(contentLength) > 1000) {
                        const contentHash = `${contentType}-${contentLength}`;
                        
                        if (!seenContentHashes.has(contentHash)) {
                            seenContentHashes.add(contentHash);
                            discoveredPages.push({
                                page: result.page,
                                contentLength: contentLength || '0',
                                contentType: contentType || 'application/pdf'
                            });
                            validPagesInBatch++;
                        }
                    }
                } else if (result.response && result.response.status === 404) {
                    errorsInBatch++;
                }
            }
            
            // Stop if no valid pages found in entire batch
            if (validPagesInBatch === 0 && errorsInBatch >= batchSize / 2) {
                console.log(`BNE: Stopping - no valid pages found in batch ${batchStart}-${batchEnd}`);
                break;
            }
            
            // Progress update every 50 pages
            if (discoveredPages.length > 0 && discoveredPages.length % 50 === 0) {
                console.log(`BNE: Discovered ${discoveredPages.length} valid pages so far...`);
            }
        }
        
        if (discoveredPages.length === 0) {
            throw new Error('No valid pages found for this BNE manuscript');
        }
        
        // Sort pages by page number
        discoveredPages.sort((a, b) => a.page - b.page);
        
        // Generate page links using optimal format for maximum resolution
        const pageLinks = discoveredPages.map(page => 
            `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page.page}&pdf=true`
        );
        
        console.log(`BNE optimized discovery completed: ${discoveredPages.length} pages found`);
        
        progressMonitor.complete();
        
        return {
            pageLinks,
            totalPages: discoveredPages.length,
            library: 'bne',
            displayName: `BNE Manuscript ${manuscriptId}`,
            originalUrl: originalUrl,
        };
        
        } catch (error: any) {
            progressMonitor.abort();
            throw error;
        }
    }


    /**
     * Load MDC Catalonia (Memòria Digital de Catalunya) manifest using robust ContentDM + IIIF approach
     * ROBUST IMPLEMENTATION based on comprehensive analysis - achieves MAXIMUM RESOLUTION
     */
    async loadMdcCataloniaManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract collection and item ID from URL
            const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
            if (!urlMatch) {
                throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
            }
            
            const collection = urlMatch[1];
            const parentId = urlMatch[2];
            console.log(`🔍 MDC Catalonia: collection=${collection}, parentId=${parentId}`);
            
            // Step 1: Get ContentDM compound object structure (most reliable method)
            const compoundXmlUrl = `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${parentId}`;
            console.log('📄 Fetching compound object XML structure...');
            
            const xmlResponse = await this.fetchDirect(compoundXmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/xml, text/xml, */*',
                    'Referer': originalUrl
                }
            });
            
            if (!xmlResponse.ok) {
                throw new Error(`Failed to fetch compound object XML: ${xmlResponse.status} ${xmlResponse.statusText}`);
            }
            
            const xmlText = await xmlResponse.text();
            console.log(`📄 XML structure retrieved (${xmlText.length} characters)`);
            
            // Step 2: Parse XML to extract all page pointers
            const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
            if (!pageMatches || pageMatches.length === 0) {
                throw new Error('No pages found in compound object XML structure');
            }
            
            console.log(`📄 Found ${pageMatches.length} pages in compound object`);
            
            // Step 3: Extract page information with robust parsing
            const pages: Array<{
                index: number;
                title: string;
                filename: string;
                pagePtr: string;
            }> = [];
            
            for (let i = 0; i < pageMatches.length; i++) {
                const pageXml = pageMatches[i];
                
                const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
                const fileMatch = pageXml.match(/<pagefile>(.*?)<\/pagefile>/);
                const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);
                
                if (titleMatch && fileMatch && ptrMatch) {
                    pages.push({
                        index: i + 1,
                        title: titleMatch[1],
                        filename: fileMatch[1],
                        pagePtr: ptrMatch[1]
                    });
                } else {
                    console.warn(`⚠️ Could not parse page ${i + 1} from XML structure`);
                }
            }
            
            if (pages.length === 0) {
                throw new Error('No valid pages could be extracted from XML structure');
            }
            
            console.log(`✅ Successfully parsed ${pages.length} pages from XML`);
            
            // Step 4: Generate image URLs with multiple resolution strategies
            const pageLinks: string[] = [];
            let validPages = 0;
            let consecutiveErrors = 0;
            const maxConsecutiveErrors = 10; // More tolerant
            
            for (const page of pages) {
                try {
                    // Multiple resolution strategies based on analysis findings:
                    // 1. /full/full/ - Maximum resolution (primary choice)
                    // 2. /full/max/ - Maximum resolution (alternative)  
                    // 3. /full/800,/ - Reduced resolution (fallback)
                    
                    const resolutionStrategies = [
                        'full/full',  // Highest quality
                        'full/max',   // Same as full/full
                        'full/800,'   // Fallback resolution
                    ];
                    
                    let successfulUrl: string | null = null;
                    
                    for (const resolution of resolutionStrategies) {
                        const candidateUrl = `https://mdc.csuc.cat/digital/iiif/${collection}/${page.pagePtr}/${resolution}/0/default.jpg`;
                        
                        try {
                            // Quick validation with HEAD request - MDC doesn't provide content-length reliably
                            const headResponse = await this.fetchDirect(candidateUrl, {
                                method: 'HEAD',
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                                    'Referer': originalUrl
                                }
                            });
                            
                            // For MDC, if we get 200 + image content-type, the image exists
                            if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
                                successfulUrl = candidateUrl;
                                console.log(`✅ Page ${page.index}: ${page.title} - ${resolution} validated`);
                                break; // Use first working resolution (full/full is preferred)
                            }
                        } catch (validationError) {
                            // Continue to next resolution strategy
                            continue;
                        }
                    }
                    
                    if (successfulUrl) {
                        pageLinks.push(successfulUrl);
                        validPages++;
                        consecutiveErrors = 0;
                    } else {
                        console.warn(`⚠️ All resolution strategies failed for page ${page.index}: ${page.title}`);
                        consecutiveErrors++;
                        
                        if (consecutiveErrors >= maxConsecutiveErrors) {
                            throw new Error(`Too many consecutive failures (${consecutiveErrors}). Archive may be temporarily unavailable.`);
                        }
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ Error processing page ${page.index}: ${(error as Error).message}`);
                    consecutiveErrors++;
                    
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                        throw new Error(`MDC Catalonia processing failed after ${consecutiveErrors} consecutive errors at page ${page.index}/${pages.length}: ${(error as Error).message}`);
                    }
                    continue;
                }
                
                // Small delay to be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs could be generated from any pages');
            }
            
            console.log(`🎯 MDC Catalonia extraction completed: ${validPages} valid pages from ${pages.length} total`);
            
            // Step 5: Return robust manifest with comprehensive metadata
            const title = `MDC Catalonia ${collection} ${parentId}`;
            const displayName = `${title} (${validPages} pages)`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'mdc_catalonia',
                displayName: displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            console.error('❌ MDC Catalonia extraction failed:', error);
            throw new Error(`Failed to load MDC Catalonia manuscript: ${(error as Error).message}`);
        }
    }


    /**
     * Load BVPB (Biblioteca Virtual del Patrimonio Bibliográfico) manifest
     */
    async loadBvpbManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            const pathMatch = originalUrl.match(/path=([^&]+)/);
            if (!pathMatch) {
                throw new Error('Could not extract path from BVPB URL');
            }
            
            const pathId = pathMatch[1];
            console.log(`Extracting BVPB manuscript path: ${pathId}`);
            
            const allImageIds: string[] = [];
            let currentPosition = 1;
            let hasMorePages = true;
            let totalPages = 0;
            let pageTitle = 'BVPB Manuscript';
            
            while (hasMorePages) {
                const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}&posicion=${currentPosition}`;
                console.log(`Discovering BVPB manuscript pages starting at position ${currentPosition}...`);
                
                const response = await this.fetchDirect(catalogUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load BVPB catalog page: ${response.status}`);
                }
                
                const html = await response.text();
                
                // Extract title from first page
                if (currentPosition === 1) {
                    try {
                        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                        if (titleMatch) {
                            pageTitle = titleMatch[1]
                                .replace(/Biblioteca Virtual del Patrimonio Bibliográfico[^>]*>\s*/gi, '')
                                .replace(/^\s*Búsqueda[^>]*>\s*/gi, '')
                                .replace(/\s*\(Objetos digitales\)\s*/gi, '')
                                .replace(/&gt;/g, '>')
                                .replace(/&rsaquo;/g, '›')
                                .replace(/&[^;]+;/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim() || pageTitle;
                        }
                    } catch (titleError) {
                        console.warn('Could not extract BVPB title:', (titleError as Error).message);
                    }
                    
                    // Extract total pages count
                    const totalMatch = html.match(/(\d+)\s*de\s*(\d+)/);
                    if (totalMatch) {
                        totalPages = parseInt(totalMatch[2]);
                        console.log(`Found total pages: ${totalPages}`);
                    }
                }
                
                // Extract image IDs from current page
                const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
                const pageImageIds: string[] = [];
                let match;
                while ((match = imageIdPattern.exec(html)) !== null) {
                    const imageId = match[1];
                    if (!pageImageIds.includes(imageId)) {
                        pageImageIds.push(imageId);
                    }
                }
                
                console.log(`Found ${pageImageIds.length} images on page starting at position ${currentPosition}`);
                allImageIds.push(...pageImageIds);
                
                // Check if there are more pages
                if (totalPages > 0 && allImageIds.length >= totalPages) {
                    hasMorePages = false;
                    console.log(`Reached total pages limit: ${totalPages}`);
                } else if (pageImageIds.length === 0) {
                    hasMorePages = false;
                    console.log('No more images found, stopping pagination');
                } else {
                    // Move to next page (BVPB shows 12 images per page)
                    currentPosition += 12;
                    
                    // Safety check - don't go beyond reasonable limits
                    if (currentPosition > 10000) {
                        console.warn('Reached safety limit, stopping pagination');
                        hasMorePages = false;
                    }
                }
            }
            
            if (allImageIds.length === 0) {
                throw new Error('No images found for this BVPB manuscript');
            }
            
            console.log(`BVPB manuscript discovery completed: ${allImageIds.length} pages found`);
            
            // Remove duplicates and sort by numeric ID to ensure proper order
            const uniqueImageIds = [...new Set(allImageIds)].sort((a, b) => parseInt(a) - parseInt(b));
            console.log(`Unique image IDs: ${uniqueImageIds.length}`);
            
            const pageLinks = uniqueImageIds.map(imageId => 
                `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`
            );
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'bvpb',
                displayName: pageTitle,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load BVPB manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Florence (ContentDM Plutei) manuscript using IIIF with maximum resolution support
     * Supports up to 6000px width for optimal quality
     */
    async loadFlorenceManifest(originalUrl: string): Promise<ManuscriptManifest> {
        // Log the start of Florence manifest loading
        this.logger.log({
            level: 'info',
            library: 'florence',
            url: originalUrl,
            message: 'Starting Florence manifest load',
            details: { method: 'loadFlorenceManifest' }
        });
        
        try {
            const urlMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/plutei\/id\/(\d+)/);
            if (!urlMatch) {
                const error = new Error('Could not extract item ID from Florence URL');
                this.logger.logDownloadError('florence', originalUrl, error);
                throw error;
            }

            const itemId = urlMatch[1];
            console.log(`🔍 Florence: itemId=${itemId}`);

            const compoundXmlUrl = `https://cdm21059.contentdm.oclc.org/utils/getfile/collection/plutei/id/${itemId}`;
            console.log('📄 Fetching Florence compound object XML structure...');

            // Use fetchWithHTTPS for Florence to handle connection issues
            const xmlResponse = await this.fetchWithHTTPS(compoundXmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/xml, text/xml, */*',
                    'Referer': originalUrl
                }
            });

            if (!xmlResponse.ok) {
                console.log('📄 No compound structure found, treating as single page');
                const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/6000,/0/default.jpg`;
                
                return {
                    pageLinks: [iiifUrl],
                    totalPages: 1,
                    library: 'florence',
                    displayName: 'Florence Manuscript',
                    originalUrl: originalUrl,
                };
            }

            const xmlText = await xmlResponse.text();
            console.log(`📄 XML structure retrieved (${xmlText.length} characters)`);

            const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
            if (!pageMatches || pageMatches.length === 0) {
                console.log('📄 No compound pages found, treating as single page');
                const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/6000,/0/default.jpg`;
                
                return {
                    pageLinks: [iiifUrl],
                    totalPages: 1,
                    library: 'florence',
                    displayName: 'Florence Manuscript',
                    originalUrl: originalUrl,
                };
            }

            console.log(`📄 Found ${pageMatches.length} pages in compound object`);

            const pages: Array<{
                pagePtr: string;
                title: string;
            }> = [];

            let displayName = 'Florence Manuscript';

            for (let i = 0; i < pageMatches.length; i++) {
                const pageXml = pageMatches[i];

                const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
                const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);

                if (!ptrMatch) {
                    console.warn(`No pageptr found for page ${i + 1}, skipping`);
                    continue;
                }

                const pagePtr = ptrMatch[1];
                const title = titleMatch ? titleMatch[1] : `Page ${i + 1}`;

                if (i === 0 && titleMatch && titleMatch[1]) {
                    const cleanTitle = titleMatch[1]
                        .replace(/^\s*carta:\s*/i, '')
                        .replace(/^\s*page\s*\d+[rv]?\s*/i, '')
                        .trim();
                    if (cleanTitle && cleanTitle.length > 3) {
                        displayName = cleanTitle;
                    }
                }

                pages.push({
                    pagePtr: pagePtr,
                    title: title
                });

                console.log(`📄 Page ${i + 1}: ${title} (ptr: ${pagePtr})`);
            }

            if (pages.length === 0) {
                throw new Error('No valid pages found in Florence compound object');
            }

            const pageLinks = pages.map(page => 
                `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${page.pagePtr}/full/6000,/0/default.jpg`
            );

            console.log(`📄 Florence manuscript processed: ${pages.length} pages with maximum resolution (6000px width)`);

            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'florence',
                displayName: displayName,
                originalUrl: originalUrl,
            };

        } catch (error: any) {
            this.logger.logDownloadError('florence', originalUrl, error as Error);
            throw new Error(`Failed to load Florence manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load ONB (Austrian National Library) manifest
     */
    async loadOnbManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL pattern: https://viewer.onb.ac.at/1000B160
            const manuscriptMatch = originalUrl.match(/viewer\.onb\.ac\.at\/([^/?&]+)/);
            if (!manuscriptMatch) {
                throw new Error('Invalid ONB URL format. Expected format: https://viewer.onb.ac.at/MANUSCRIPT_ID');
            }
            
            const manuscriptId = manuscriptMatch[1];
            console.log(`Extracting ONB manuscript ID: ${manuscriptId}`);
            
            // Construct the IIIF v3 manifest URL based on the API pattern
            const manifestUrl = `https://api.onb.ac.at/iiif/presentation/v3/manifest/${manuscriptId}`;
            console.log(`Fetching ONB IIIF v3 manifest: ${manifestUrl}`);
            
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch ONB manifest: ${response.status} ${response.statusText}`);
            }
            
            let manifestData;
            try {
                manifestData = await response.json();
            } catch (parseError) {
                throw new Error(`Failed to parse ONB manifest JSON: ${(parseError as Error).message}`);
            }
            
            // Extract pages from IIIF v3 manifest
            const pageLinks: string[] = [];
            
            if (!manifestData.items || !Array.isArray(manifestData.items)) {
                throw new Error('Invalid ONB manifest: no items array found');
            }
            
            console.log(`Processing ONB manifest with ${manifestData.items.length} canvases`);
            
            for (const canvas of manifestData.items) {
                if (!canvas.items || !Array.isArray(canvas.items)) {
                    console.warn(`Skipping canvas without items: ${canvas.id}`);
                    continue;
                }
                
                for (const annotationPage of canvas.items) {
                    if (!annotationPage.items || !Array.isArray(annotationPage.items)) {
                        continue;
                    }
                    
                    for (const annotation of annotationPage.items) {
                        if (annotation.body && annotation.body.service && Array.isArray(annotation.body.service)) {
                            // Find IIIF Image API service
                            const imageService = annotation.body.service.find((service: any) => 
                                service.type === 'ImageService3' || service['@type'] === 'ImageService'
                            );
                            
                            if (imageService && imageService.id) {
                                // Use maximum resolution: /full/max/0/default.jpg
                                const imageUrl = `${imageService.id}/full/max/0/default.jpg`;
                                pageLinks.push(imageUrl);
                                break; // Take the first valid image from this canvas
                            }
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid images found in ONB manifest');
            }
            
            // Extract title from manifest metadata
            let displayName = `ONB Manuscript ${manuscriptId}`;
            if (manifestData.label) {
                if (typeof manifestData.label === 'string') {
                    displayName = manifestData.label;
                } else if (manifestData.label.en && Array.isArray(manifestData.label.en)) {
                    displayName = manifestData.label.en[0];
                } else if (manifestData.label.de && Array.isArray(manifestData.label.de)) {
                    displayName = manifestData.label.de[0];
                }
            }
            
            console.log(`ONB manifest loaded successfully: ${pageLinks.length} pages found - "${displayName}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'onb' as any,
                displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load ONB manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Rouen Municipal Library manifest
     */
    async loadRouenManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL pattern: 
            // https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom
            const arkMatch = originalUrl.match(/ark:\/12148\/([^/?\s]+)/);
            if (!arkMatch) {
                throw new Error('Invalid Rouen URL format. Expected format: https://www.rotomagus.fr/ark:/12148/MANUSCRIPT_ID/f{page}.item.zoom');
            }
            
            const manuscriptId = arkMatch[1];
            console.log(`Extracting Rouen manuscript ID: ${manuscriptId}`);
            
            // Try to get page count from manifest JSON first
            const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
            console.log(`Fetching Rouen manifest: ${manifestUrl}`);
            
            let totalPages = 0;
            let displayName = `Rouen Manuscript ${manuscriptId}`;
            
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Referer': originalUrl
                    }
                });
                
                if (manifestResponse.ok) {
                    const manifestData = await manifestResponse.json();
                    console.log('Rouen manifest loaded successfully, searching for page count...');
                    
                    // The manifest has a complex nested structure with multiple repetitions
                    // Try multiple approaches to find the page count
                    let foundPageCount = null;
                    
                    // Method 1: Search for totalNumberPage in nested PageAViewerFragment structures
                    if (manifestData.PageAViewerFragment?.parameters?.fragmentDownload?.contenu?.libelles?.totalNumberPage) {
                        foundPageCount = manifestData.PageAViewerFragment.parameters.fragmentDownload.contenu.libelles.totalNumberPage;
                        console.log(`Found totalNumberPage in PageAViewerFragment.libelles: ${foundPageCount}`);
                    }
                    
                    // Method 2: Search for totalVues in PageAViewerFragment
                    if (!foundPageCount && manifestData.PageAViewerFragment?.parameters?.totalVues) {
                        foundPageCount = manifestData.PageAViewerFragment.parameters.totalVues;
                        console.log(`Found totalVues in PageAViewerFragment: ${foundPageCount}`);
                    }
                    
                    // Method 3: Search for nbTotalVues in PaginationViewerModel
                    if (!foundPageCount && manifestData.PageAViewerFragment?.contenu?.PaginationViewerModel?.parameters?.nbTotalVues) {
                        foundPageCount = manifestData.PageAViewerFragment.contenu.PaginationViewerModel.parameters.nbTotalVues;
                        console.log(`Found nbTotalVues in PaginationViewerModel: ${foundPageCount}`);
                    }
                    
                    // Method 4: Recursive search through the entire manifest for totalNumberPage or totalVues
                    if (!foundPageCount) {
                        const findPageCount = (obj: any): number | null => {
                            if (typeof obj !== 'object' || obj === null) return null;
                            
                            // Check current level for page count fields
                            if (typeof obj.totalNumberPage === 'number' && obj.totalNumberPage > 0) {
                                return obj.totalNumberPage;
                            }
                            if (typeof obj.totalVues === 'number' && obj.totalVues > 0) {
                                return obj.totalVues;
                            }
                            
                            // Recursively search nested objects and arrays
                            for (const key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                    const result = findPageCount(obj[key]);
                                    if (result !== null) return result;
                                }
                            }
                            
                            return null;
                        };
                        
                        foundPageCount = findPageCount(manifestData);
                        if (foundPageCount) {
                            console.log(`Found page count via recursive search: ${foundPageCount}`);
                        }
                    }
                    
                    if (foundPageCount && typeof foundPageCount === 'number' && foundPageCount > 0) {
                        totalPages = foundPageCount;
                        console.log(`Successfully determined page count: ${totalPages}`);
                        
                        // Try to extract title from manifest - also search recursively
                        const findTitle = (obj: any, keys: string[]): string | null => {
                            if (typeof obj !== 'object' || obj === null) return null;
                            
                            for (const key of keys) {
                                if (typeof obj[key] === 'string' && obj[key].trim()) {
                                    return obj[key].trim();
                                }
                            }
                            
                            // Recursively search
                            for (const key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                    const result = findTitle(obj[key], keys);
                                    if (result) return result;
                                }
                            }
                            
                            return null;
                        };
                        
                        const titleKeys = ['title', 'label', 'nom', 'libelle', 'intitule'];
                        const foundTitle = findTitle(manifestData, titleKeys);
                        if (foundTitle) {
                            displayName = foundTitle;
                            console.log(`Found title: ${displayName}`);
                        }
                    }
                }
            } catch (manifestError) {
                console.warn(`Failed to fetch Rouen manifest, will attempt page discovery: ${(manifestError as Error).message}`);
            }
            
            // Fallback: Try to get page count from viewer page
            if (totalPages === 0) {
                try {
                    const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
                    console.log(`Fallback: fetching viewer page for page discovery: ${viewerUrl}`);
                    
                    const viewerResponse = await this.fetchDirect(viewerUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    
                    if (viewerResponse.ok) {
                        const viewerHtml = await viewerResponse.text();
                        
                        // Look for page count patterns in the HTML/JavaScript
                        const patterns = [
                            /"totalNumberPage"\s*:\s*(\d+)/,
                            /"totalVues"\s*:\s*(\d+)/,
                            /"nbTotalVues"\s*:\s*(\d+)/,
                            /totalNumberPage["']?\s*:\s*(\d+)/
                        ];
                        
                        for (const pattern of patterns) {
                            const match = viewerHtml.match(pattern);
                            if (match && match[1]) {
                                totalPages = parseInt(match[1], 10);
                                console.log(`Found page count via viewer page pattern: ${totalPages}`);
                                break;
                            }
                        }
                    }
                } catch (viewerError) {
                    console.warn(`Failed to fetch viewer page: ${(viewerError as Error).message}`);
                }
            }
            
            if (totalPages === 0) {
                throw new Error('Could not determine page count for Rouen manuscript');
            }
            
            // Generate page URLs using the highres resolution for maximum quality
            const pageLinks: string[] = [];
            
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${i}.highres`;
                pageLinks.push(imageUrl);
            }
            
            console.log(`Generated ${pageLinks.length} page URLs for Rouen manuscript`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'rouen' as const,
                displayName,
                originalUrl: originalUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Rouen manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load University of Freiburg manuscript manifest using METS XML parsing
     */
    async loadFreiburgManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Freiburg manuscript from: ${originalUrl}`);
            
            // Extract manuscript ID from URL - matches patterns like:
            // https://dl.ub.uni-freiburg.de/diglit/codal_25
            // https://dl.ub.uni-freiburg.de/diglit/codal_25/0001
            const manuscriptMatch = originalUrl.match(/\/diglit\/([^/?]+)/);
            if (!manuscriptMatch) {
                throw new Error('Invalid Freiburg URL format - cannot extract manuscript ID');
            }
            
            const manuscriptId = manuscriptMatch[1];
            console.log(`Extracted manuscript ID: ${manuscriptId}`);
            
            // Get manuscript metadata from the main page
            const metadataUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
            console.log(`Fetching metadata from: ${metadataUrl}`);
            
            const metadataResponse = await this.fetchDirect(metadataUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!metadataResponse.ok) {
                throw new Error(`HTTP ${metadataResponse.status}: ${metadataResponse.statusText}`);
            }
            
            const metadataHtml = await metadataResponse.text();
            
            // Extract display name from metadata page
            let displayName = `Freiburg Manuscript ${manuscriptId}`;
            const dom = new JSDOM(metadataHtml);
            const document = dom.window.document;
            
            // Try multiple selectors for title extraction
            const titleSelectors = [
                'h1.page-header',
                '.metadata-title',
                'h1',
                'title'
            ];
            
            for (const selector of titleSelectors) {
                const titleElement = document.querySelector(selector);
                if (titleElement && titleElement.textContent?.trim()) {
                    displayName = titleElement.textContent.trim();
                    break;
                }
            }
            
            console.log(`Extracted display name: ${displayName}`);
            
            // Use thumbs page for complete page discovery (METS XML returns 302 redirects)
            const thumbsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/0001/thumbs`;
            console.log(`Fetching thumbs page: ${thumbsUrl}`);
            
            const thumbsResponse = await this.fetchDirect(thumbsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!thumbsResponse.ok) {
                throw new Error(`Failed to fetch thumbs page: HTTP ${thumbsResponse.status}`);
            }
            
            const thumbsHtml = await thumbsResponse.text();
            console.log(`Thumbs HTML length: ${thumbsHtml.length} characters`);
            
            // Extract all unique page numbers from thumbs page
            const thumbsDom = new JSDOM(thumbsHtml);
            const allLinks = thumbsDom.window.document.querySelectorAll('a[href*="/diglit/"]');
            
            const uniquePages = new Set<string>();
            allLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const pageMatch = href.match(/\/diglit\/[^/]+\/(\d{4})/);
                    if (pageMatch) {
                        uniquePages.add(pageMatch[1]);
                    }
                }
            });
            
            const sortedPages = Array.from(uniquePages).sort((a, b) => parseInt(a) - parseInt(b));
            console.log(`Found ${sortedPages.length} unique pages`);
            
            if (sortedPages.length === 0) {
                throw new Error('No pages found in thumbs page');
            }
            
            // Extract image URLs from pages in batches
            const pageLinks: string[] = [];
            const batchSize = 10;
            
            for (let i = 0; i < sortedPages.length; i += batchSize) {
                const batch = sortedPages.slice(i, i + batchSize);
                const batchPromises = batch.map(async (pageNumber) => {
                    const pageUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/${pageNumber}`;
                    
                    try {
                        const pageResponse = await this.fetchDirect(pageUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                                'Cache-Control': 'no-cache'
                            }
                        });
                        
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            const pageDom = new JSDOM(pageHtml);
                            
                            const imageElements = pageDom.window.document.querySelectorAll('img[src*="diglitData"]');
                            
                            if (imageElements.length > 0) {
                                const imageUrl = imageElements[0].getAttribute('src');
                                if (imageUrl) {
                                    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `https://dl.ub.uni-freiburg.de${imageUrl}`;
                                    // Upgrade to maximum resolution level 4 for highest quality
                                    const maxResolutionUrl = fullImageUrl.replace(/\/\d+\//, '/4/');
                                    return maxResolutionUrl;
                                }
                            }
                        }
                        
                        return null;
                    } catch (error) {
                        console.warn(`Failed to fetch page ${pageNumber}: ${(error as Error).message}`);
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                pageLinks.push(...batchResults.filter((url): url is string => url !== null));
                
                // Progress logging
                if (i % 50 === 0) {
                    console.log(`Processed ${Math.min(i + batchSize, sortedPages.length)} of ${sortedPages.length} pages`);
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid page images found');
            }
            
            console.log(`Successfully extracted ${pageLinks.length} page links`);
            
            // Create manifest structure
            const manifest: ManuscriptManifest = {
                pageLinks: pageLinks,
                totalPages: pageLinks.length,
                library: 'freiburg' as any,
                displayName: displayName,
                originalUrl: originalUrl
            };
            
            console.log(`Freiburg manifest created successfully with ${pageLinks.length} pages`);
            return manifest;
            
        } catch (error: any) {
            console.error('Freiburg manifest loading error:', error);
            throw new Error(`Failed to load Freiburg manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Fulda University of Applied Sciences manifest (IIIF v2.0)
     */
    async loadFuldaManifest(fuldaUrl: string): Promise<ManuscriptManifest> {
        try {
            // URL formats: 
            // - https://fuldig.hs-fulda.de/viewer/image/{PPN_ID}/[page]/
            // - https://fuldig.hs-fulda.de/viewer/api/v1/records/{PPN_ID}/manifest/
            const urlMatch = fuldaUrl.match(/(?:\/image\/|\/records\/)([^/]+)/);
            if (!urlMatch) {
                throw new Error('Could not extract PPN ID from Fulda URL');
            }

            const ppnId = urlMatch[1];
            let displayName = `Fulda University Digital Collection - ${ppnId}`;

            // Construct IIIF manifest URL
            const manifestUrl = `https://fuldig.hs-fulda.de/viewer/api/v1/records/${ppnId}/manifest/`;

            console.log('Loading Fulda manifest from:', manifestUrl);
            const response = await fetch(manifestUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} when fetching Fulda manifest`);
            }

            const manifest = await response.json();

            // Extract title from manifest
            if (manifest.label) {
                displayName = `Fulda University - ${manifest.label}`;
            }

            console.log(`Processing Fulda IIIF manifest: ${displayName}`);

            if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }

            const canvases = manifest.sequences[0].canvases;
            const pageLinks: string[] = [];

            // Process each canvas to extract maximum quality image URLs
            for (const canvas of canvases) {
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    let imageUrl = '';

                    if (image.resource && image.resource.service) {
                        // IIIF Image API service
                        const serviceId = image.resource.service['@id'] || image.resource.service.id;
                        if (serviceId) {
                            // Use maximum quality parameters for Fulda IIIF v2.0
                            imageUrl = `${serviceId}/full/max/0/default.jpg`;
                        }
                    } else if (image.resource && image.resource['@id']) {
                        // Direct image URL
                        imageUrl = image.resource['@id'];
                    }

                    if (imageUrl) {
                        pageLinks.push(imageUrl);
                    }
                }
            }

            if (pageLinks.length === 0) {
                throw new Error('No images found in Fulda manifest');
            }

            console.log(`Found ${pageLinks.length} pages in Fulda manuscript`);

            const fuldaManifest = {
                displayName,
                pageLinks,
                library: 'fulda' as const,
                manifestUrl,
                originalUrl: fuldaUrl,
                totalPages: pageLinks.length
            };

            this.manifestCache.set(fuldaUrl, fuldaManifest).catch(console.warn);

            return fuldaManifest;

        } catch (error) {
            throw new Error(`Failed to load Fulda manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load Wolfenbüttel Digital Library manifest
     */
    async loadWolfenbuettelManifest(wolfenbuettelUrl: string): Promise<ManuscriptManifest> {
        try {
            // URL formats:
            // 1. https://diglib.hab.de/wdb.php?dir=mss/1008-helmst
            // 2. https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=
            
            let manuscriptId: string;
            
            // Try original format first
            const dirMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
            if (dirMatch) {
                manuscriptId = dirMatch[1];
            } else {
                // Try alternative format - extract from path
                const pathMatch = wolfenbuettelUrl.match(/diglib\.hab\.de\/([^/]+\/[^/]+\/[^/]+)/);
                if (!pathMatch) {
                    throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
                }
                manuscriptId = pathMatch[1]; // e.g., "varia/selecta/ed000011"
            }
            console.log(`Loading Wolfenbüttel manuscript: ${manuscriptId}`);
            
            // First try to get page list from thumbs.php with pagination
            const pageLinks: string[] = [];
            const allImageNames: string[] = [];
            
            try {
                let pointer = 0;
                let hasMorePages = true;
                
                while (hasMorePages) {
                    // Construct thumbs URL based on manuscript ID format
                    let thumbsUrl: string;
                    if (manuscriptId.startsWith('mss/')) {
                        // Already has mss/ prefix
                        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
                    } else if (manuscriptId.includes('/')) {
                        // Alternative format like varia/selecta/ed000011
                        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
                    } else {
                        // Just the manuscript number
                        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
                    }
                    console.log(`Fetching page list from: ${thumbsUrl} (pointer=${pointer})`);
                    
                    const thumbsResponse = await this.fetchWithProxyFallback(thumbsUrl);
                    if (thumbsResponse.ok) {
                        const thumbsHtml = await thumbsResponse.text();
                        
                        // Extract image names from current thumbs page
                        const imageMatches = thumbsHtml.matchAll(/image=([^'"&]+)/g);
                        const imageNames = Array.from(imageMatches, m => m[1]);
                        
                        if (imageNames.length > 0) {
                            allImageNames.push(...imageNames);
                            console.log(`Found ${imageNames.length} images on page (total so far: ${allImageNames.length})`);
                            
                            // Check if there's a next page link (forward button)
                            // Updated regex to handle both mss/ and other directory structures
                            const nextPageMatch = thumbsHtml.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
                            if (nextPageMatch) {
                                const nextPointer = parseInt(nextPageMatch[1], 10);
                                // Check if we're stuck on the same page (last page scenario)
                                if (nextPointer === pointer) {
                                    hasMorePages = false;
                                } else {
                                    pointer = nextPointer;
                                }
                            } else {
                                hasMorePages = false;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    } else {
                        hasMorePages = false;
                    }
                }
                
                if (allImageNames.length > 0) {
                    // Remove duplicates from collected image names
                    const uniqueImageNames = [...new Set(allImageNames)];
                    console.log(`Total unique images found: ${uniqueImageNames.length} (from ${allImageNames.length} total)`);
                    
                    // Convert all unique image names to full URLs using maximum resolution
                    for (const imageName of uniqueImageNames) {
                        let imageUrl: string;
                        if (manuscriptId.includes('/')) {
                            // Already includes path structure
                            imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
                        } else {
                            // Just manuscript number, add mss/ prefix
                            imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
                        }
                        pageLinks.push(imageUrl);
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch thumbs pages: ${error}`);
            }
            
            // If thumbs approach failed, fall back to sequential number testing
            if (pageLinks.length === 0) {
                console.log('Falling back to sequential page detection');
                let baseImageUrl: string;
                if (manuscriptId.includes('/')) {
                    // Already includes path structure
                    baseImageUrl = `http://diglib.hab.de/${manuscriptId}/max`;
                } else {
                    // Just manuscript number, add mss/ prefix
                    baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
                }
                
                let pageNum = 1;
                let consecutiveFailures = 0;
                
                while (consecutiveFailures < 10 && pageNum <= 500) { // Maximum 500 pages
                    const pageStr = pageNum.toString().padStart(5, '0');
                    const imageUrl = `${baseImageUrl}/${pageStr}.jpg`;
                    
                    try {
                        const response = await this.fetchWithProxyFallback(imageUrl);
                        if (response.status === 200) {
                            pageLinks.push(imageUrl);
                            consecutiveFailures = 0;
                        } else {
                            consecutiveFailures++;
                        }
                    } catch (error) {
                        consecutiveFailures++;
                    }
                    
                    pageNum++;
                }
            }

            if (pageLinks.length === 0) {
                throw new Error(`No pages found for Wolfenbüttel manuscript: ${manuscriptId}`);
            }

            const displayName = `Wolfenbüttel HAB MS ${manuscriptId}`;
            
            console.log(`Found ${pageLinks.length} pages in Wolfenbüttel manuscript`);

            const wolfenbuettelManifest = {
                displayName,
                pageLinks,
                library: 'wolfenbuettel' as const,
                manifestUrl: wolfenbuettelUrl,
                originalUrl: wolfenbuettelUrl,
                totalPages: pageLinks.length
            };

            this.manifestCache.set(wolfenbuettelUrl, wolfenbuettelManifest).catch(console.warn);

            return wolfenbuettelManifest;

        } catch (error) {
            throw new Error(`Failed to load Wolfenbüttel manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Load HHU Düsseldorf Digital Library manifest
     */
    async loadHhuManifest(hhuUrl: string): Promise<ManuscriptManifest> {
        const startTime = Date.now();
        console.log(`[HHU] Starting manifest load from URL: ${hhuUrl}`);
        
        try {
            // Extract manuscript ID from URL
            // URL format: https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
            let manifestUrl: string;
            let manuscriptId: string | null = null;
            
            console.log('[HHU] Parsing URL to extract manuscript ID...');
            
            if (hhuUrl.includes('/manifest')) {
                // Already a manifest URL
                manifestUrl = hhuUrl;
                const idMatch = hhuUrl.match(/\/v20\/(\d+)\/manifest/);
                if (idMatch) {
                    manuscriptId = idMatch[1];
                }
                console.log(`[HHU] Found manifest URL, manuscript ID: ${manuscriptId}`);
            } else {
                // Extract ID from various URL formats
                let idMatch = hhuUrl.match(/\/v20\/(\d+)/);
                if (!idMatch) {
                    // Try content/titleinfo format
                    idMatch = hhuUrl.match(/\/titleinfo\/(\d+)/);
                }
                if (!idMatch) {
                    // Try content/pageview format
                    idMatch = hhuUrl.match(/\/pageview\/(\d+)/);
                }
                if (!idMatch) {
                    throw new Error('Could not extract manuscript ID from HHU URL');
                }
                manuscriptId = idMatch[1];
                manifestUrl = `https://digital.ulb.hhu.de/i3f/v20/${manuscriptId}/manifest`;
                console.log(`[HHU] Extracted manuscript ID: ${manuscriptId}, manifest URL: ${manifestUrl}`);
            }
            
            let displayName = `HHU Düsseldorf - ${manuscriptId || 'Manuscript'}`;
            
            console.log(`[HHU] Loading manifest from: ${manifestUrl}`);
            
            // Set a timeout for the manifest fetch
            const fetchTimeout = 60000; // 60 seconds timeout for manifest loading
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`HHU manifest loading timeout after ${fetchTimeout / 1000} seconds`));
                }, fetchTimeout);
            });
            
            try {
                const response = await Promise.race([
                    this.fetchWithHTTPS(manifestUrl),
                    timeoutPromise
                ]);
                
                console.log(`[HHU] Manifest fetch completed in ${Date.now() - startTime}ms`);
                console.log(`[HHU] Parsing manifest JSON...`);
                
                const manifest = JSON.parse(response);
            
                // Extract metadata from IIIF manifest
                if (manifest.label) {
                    displayName = `HHU - ${manifest.label}`;
                    console.log(`[HHU] Manuscript label: ${manifest.label}`);
                }
                
                if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
                    console.error('[HHU] Invalid manifest structure:', {
                        hasSequences: !!manifest.sequences,
                        hasFirstSequence: !!(manifest.sequences && manifest.sequences[0]),
                        hasCanvases: !!(manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases)
                    });
                    throw new Error('Invalid IIIF manifest structure - missing sequences or canvases');
                }
                
                const canvases = manifest.sequences[0].canvases;
                const pageLinks: string[] = [];
                
                console.log(`[HHU] Processing ${canvases.length} pages from manuscript`);
                
                // Process each canvas to extract maximum quality image URLs
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    if (!canvas.images || !canvas.images[0]) {
                        console.warn(`[HHU] Canvas ${i + 1} has no images, skipping`);
                        continue;
                    }
                    
                    const image = canvas.images[0];
                    const resource = image.resource;
                    
                    if (resource.service && resource.service['@id']) {
                        const serviceId = resource.service['@id'];
                        // Use maximum resolution - full/full/0/default.jpg
                        const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        pageLinks.push(imageUrl);
                        if (i < 3 || i === canvases.length - 1) {
                            console.log(`[HHU] Page ${i + 1} image URL: ${imageUrl}`);
                        }
                    } else if (resource['@id']) {
                        // Fallback to direct image URL
                        pageLinks.push(resource['@id']);
                        console.log(`[HHU] Page ${i + 1} using direct URL: ${resource['@id']}`);
                    } else {
                        console.warn(`[HHU] Page ${i + 1} has no accessible image URL`);
                    }
                }
                
                if (pageLinks.length === 0) {
                    console.error('[HHU] No valid image URLs found in manifest');
                    throw new Error('No images found in HHU manifest');
                }
                
                console.log(`[HHU] Successfully extracted ${pageLinks.length} pages in ${Date.now() - startTime}ms`);
                this.logInfo('hhu', manifestUrl, 'HHU manifest processing complete', {
                    totalPages: pageLinks.length,
                    processingTime: Date.now() - startTime,
                    firstPageUrl: pageLinks[0]?.substring(0, 100) + '...'
                });
                
                return {
                    displayName,
                    totalPages: pageLinks.length,
                    library: 'hhu',
                    pageLinks,
                    originalUrl: hhuUrl
                };
                
            } catch (fetchError: any) {
                console.error(`[HHU] Manifest fetch/parse error: ${fetchError.message}`);
                throw fetchError;
            }
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error(`[HHU] Failed to load manifest after ${duration}ms:`, {
                url: hhuUrl,
                error: error.message,
                stack: error.stack
            });
            
            // Provide more specific error messages
            if (error.message.includes('timeout')) {
                throw new Error(`HHU Düsseldorf manifest loading timed out after ${duration / 1000} seconds. The server may be slow or unresponsive. Please try again later or check if the manuscript is accessible at ${hhuUrl}`);
            } else if (error.message.includes('Could not extract manuscript ID')) {
                throw new Error(`Invalid HHU URL format. Expected formats: /i3f/v20/[ID]/manifest, /content/titleinfo/[ID], or /content/pageview/[ID]. Received: ${hhuUrl}`);
            } else if (error.message.includes('Invalid IIIF manifest structure')) {
                throw new Error(`HHU server returned an invalid IIIF manifest. The manuscript may not be available or the server format may have changed.`);
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                throw new Error(`Cannot connect to HHU Düsseldorf server. Please check your internet connection and verify the URL is correct.`);
            } else {
                throw new Error(`Failed to load HHU Düsseldorf manuscript: ${error.message}`);
            }
        }
    }

}