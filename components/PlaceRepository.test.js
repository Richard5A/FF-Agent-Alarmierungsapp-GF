// Mock data for places
const mockPlaces = [
    {
        "name": "Sekretariat",
        "aliases": ["Seki"],
        "lat": 1,
        "lng": 1,
        "description": "Test description 1"
    },
    {
        "name": "C5",
        "isPrefix": true,
        "lat": 2,
        "lng": 2,
        "description": "Test description 2"
    },
    {
        "name": "Mensa",
        "aliases": [],
        "lat": 3,
        "lng": 3,
        "description": "Test description 3"
    },
    {
        "name": "Turnhalle 1",
        "isPrefix": true,
        "aliases": ["TH1"],
        "lat": 4,
        "lng": 4,
        "description": "Test description 4"
    }
];

// Mock the require call for places.json. This will be hoisted by Jest.
jest.mock('./places.json', () => mockPlaces, { virtual: true });

describe('PlaceRepository', () => {
    let placeRepository;

    beforeEach(() => {
        // Reset modules to clear the cache before each test, ensuring a fresh mock
        jest.resetModules();
        // Dynamically import PlaceRepository to use the fresh mock
        const { PlaceRepository } = require('./PlaceRepository');
        placeRepository = new PlaceRepository();
    });

    describe('findPlace', () => {
        it('should find a place by its exact name', () => {
            const place = placeRepository.findPlace('Sekretariat');
            expect(place).toBeDefined();
            expect(place.name).toBe('Sekretariat');
        });

        it('should find a place by its exact alias', () => {
            const place = placeRepository.findPlace('Seki');
            expect(place).toBeDefined();
            expect(place.name).toBe('Sekretariat');
        });

        it('should perform a case-insensitive search', () => {
            const place = placeRepository.findPlace('sekretariat');
            expect(place).toBeDefined();
            expect(place.name).toBe('Sekretariat');
        });

        it('should find a place by a defined prefix', () => {
            const place = placeRepository.findPlace('C5-123');
            expect(place).toBeDefined();
            expect(place.name).toBe('C5');
        });

        it('should find a place by prefix with a case-insensitive search', () => {
            const place = placeRepository.findPlace('c5-xyz');
            expect(place).toBeDefined();
            expect(place.name).toBe('C5');
        });

        it('should return null when no place is found', () => {
            const place = placeRepository.findPlace('Unknown Place');
            expect(place).toBeNull();
        });

        it('should find a place by an alias prefix with space', () => {
            const place = placeRepository.findPlace('TH1 abc');
            expect(place).toBeDefined();
            expect(place.name).toBe('Turnhalle 1');
        });

        it('should not find a place by prefix if isPrefix is not set to true', () => {
            const place = placeRepository.findPlace('Mensa-Extra');
            expect(place).toBeNull();
        });

        it('should find a place by an alias prefix', () => {
            const place = placeRepository.findPlace('TH1-abc');
            expect(place).toBeDefined();
            expect(place.name).toBe('Turnhalle 1');
        });
    });

    describe('getAllPlaceNames', () => {
        it('should return all available places', () => {
            const places = placeRepository.getAllPlaceNames();
            expect(places).toEqual(mockPlaces);
        });
    });
});
