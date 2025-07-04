import { describe, it, expect } from 'vitest';
import {ArgParseError, argumentsRegistry, ArgumentsRegistry} from "../../../src/commands/arguments";


describe('ArgumentsRegistry', () => {
    it('parses a string', async () => {
        const parser = argumentsRegistry.get('string');
        expect(await parser('abc', {})).toBe('abc');
    });

    it('parses a number', async () => {
        const parser = argumentsRegistry.get('number');
        expect(await parser('42', {})).toBe(42);
    });

    it('throws on invalid number', async () => {
        const parser = argumentsRegistry.get('number');
        await expect(parser('not-a-number', {})).rejects.toThrow(/not a valid number/i);
    });

    it('registers and parses a custom type', async () => {
        const custom = new ArgumentsRegistry();
        custom.register('foo', (raw) => raw.toUpperCase());
        const parser = custom.get('foo');
        expect(await parser('bar', {})).toBe('BAR');
    });

    it('throws if parser is not registered', () => {
        const custom = new ArgumentsRegistry();
        expect(() => custom.get('notype')).toThrow(/no parser/i);
    });
});

describe('ArgParseError', () => {
    it('is an instance of Error', () => {
        const err = new ArgParseError('msg');
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('msg');
        expect(err.name).toBe('ArgParseError');
    });
});
