import { MirimUser, mirimUserFromJson, mirimUserToJson } from '../src/mirim-user';

describe('MirimUser', () => {
  const sampleUser: MirimUser = {
    id: '123',
    email: 'test@example.com',
    nickname: 'tester',
    major: 'Software',
    isGraduated: false,
    admission: '2023',
    role: 'student',
    generation: 10,
  };

  const sampleJson = {
    id: 123,
    email: 'test@example.com',
    nickname: 'tester',
    major: 'Software',
    isGraduated: false,
    admission: '2023',
    role: 'student',
    generation: 10,
  };

  const minimalJson = {
    id: '456',
    email: 'minimal@example.com',
  };

  const minimalUser: MirimUser = {
    id: '456',
    email: 'minimal@example.com',
  };


  describe('mirimUserFromJson', () => {
    it('should convert full JSON to MirimUser correctly', () => {
      const user = mirimUserFromJson(sampleJson);
      expect(user.id).toBe(String(sampleJson.id));
      expect(user.email).toBe(sampleJson.email);
      expect(user.nickname).toBe(sampleJson.nickname);
      expect(user.major).toBe(sampleJson.major);
      expect(user.isGraduated).toBe(sampleJson.isGraduated);
      expect(user.admission).toBe(sampleJson.admission);
      expect(user.role).toBe(sampleJson.role);
      expect(user.generation).toBe(sampleJson.generation);
    });

    it('should convert minimal JSON to MirimUser correctly', () => {
      const user = mirimUserFromJson(minimalJson);
      expect(user.id).toBe(minimalJson.id);
      expect(user.email).toBe(minimalJson.email);
      expect(user.nickname).toBeUndefined();
      expect(user.major).toBeUndefined();
      expect(user.isGraduated).toBeUndefined();
      expect(user.admission).toBeUndefined();
      expect(user.role).toBeUndefined();
      expect(user.generation).toBeUndefined();
    });

    it('should handle null or undefined values in JSON', () => {
      const jsonWithNulls = {
        id: 789,
        email: 'nulls@example.com',
        nickname: null,
        major: undefined,
        isGraduated: 'not a boolean',
      };
      const user = mirimUserFromJson(jsonWithNulls);
      expect(user.id).toBe(String(jsonWithNulls.id));
      expect(user.email).toBe(jsonWithNulls.email);
      expect(user.nickname).toBeUndefined();
      expect(user.major).toBeUndefined();
      expect(user.isGraduated).toBeUndefined();
    });

     it('should handle empty JSON', () => {
      const user = mirimUserFromJson({});
      expect(user.id).toBe('');
      expect(user.email).toBe('');
      expect(user.nickname).toBeUndefined();
    });
  });

  describe('mirimUserToJson', () => {
    it('should convert MirimUser to JSON correctly', () => {
      const json = mirimUserToJson(sampleUser);
      expect(json.id).toBe(sampleUser.id);
      expect(json.email).toBe(sampleUser.email);
      expect(json.nickname).toBe(sampleUser.nickname);
      expect(json.major).toBe(sampleUser.major);
      expect(json.isGraduated).toBe(sampleUser.isGraduated);
      expect(json.admission).toBe(sampleUser.admission);
      expect(json.role).toBe(sampleUser.role);
      expect(json.generation).toBe(sampleUser.generation);
    });

    it('should convert minimal MirimUser to JSON correctly', () => {
      const json = mirimUserToJson(minimalUser);
      expect(json.id).toBe(minimalUser.id);
      expect(json.email).toBe(minimalUser.email);
      expect(json.nickname).toBeUndefined();
    });
  });
});
